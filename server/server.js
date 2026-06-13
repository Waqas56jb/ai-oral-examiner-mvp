import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import OpenAI from 'openai'

import { config, getApiKey } from './config.js'
import { buildExaminerInstructions, buildFeedbackUserPrompt, normalizeQuestion, SAMPLE_CASE } from './prompts/examiner.js'
import { getRandomQuestion, getQuestionById, saveSession } from './db/repo.js'

const apiKey = getApiKey()
const openai = new OpenAI({ apiKey })

const app = express()
app.use(express.json({ limit: '1mb' }))
app.use(
  cors({
    origin(origin, cb) {
      // allow same-origin / curl (no origin) and the whitelisted dev origins
      if (!origin || config.allowedOrigins.includes(origin)) return cb(null, true)
      return cb(null, true) // relaxed for the MVP; tighten before production
    },
  })
)

/* ------------------------------------------------------------------ */
/*  Health                                                            */
/* ------------------------------------------------------------------ */
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'passgp-server',
    chatModel: config.chatModel,
    realtimeModel: config.realtimeModel,
    case: SAMPLE_CASE.id,
  })
})

/* ------------------------------------------------------------------ */
/*  Realtime voice — mint a short-lived ephemeral token                */
/*  The browser uses this token to open a WebRTC connection directly   */
/*  to OpenAI. The real OPENAI_API_KEY never leaves this server.        */
/* ------------------------------------------------------------------ */
app.post('/api/realtime/session', async (req, res) => {
  try {
    const { candidateName, examType = 'RACGP', questionId } = req.body || {}

    // Pull a case from the admin-managed question bank (fallback: sample case).
    const dbQuestion = questionId
      ? await getQuestionById(questionId)
      : await getRandomQuestion(examType)
    const question = normalizeQuestion(dbQuestion)

    const instructions = buildExaminerInstructions({
      examType,
      candidateName,
      forVoice: true,
      question,
    })

    const response = await fetch(config.realtimeClientSecretsUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session: {
          type: 'realtime',
          model: config.realtimeModel,
          instructions,
          audio: {
            input: {
              transcription: { model: config.transcriptionModel },
              // Filter out background noise before it reaches the model.
              noise_reduction: { type: 'near_field' },
              // Semantic VAD waits for a natural end-of-turn instead of
              // reacting to every blip of background sound.
              turn_detection: {
                type: 'semantic_vad',
                eagerness: 'low',
                create_response: true,
                interrupt_response: true,
              },
            },
            output: { voice: config.voice, speed: 1.0 },
          },
        },
      }),
    })

    if (!response.ok) {
      const detail = await response.text()
      console.error('Realtime session error:', response.status, detail)
      return res.status(response.status).json({ error: 'Failed to create realtime session', detail })
    }

    const data = await response.json()

    // Normalise what the browser needs: the ephemeral key, the model, and the
    // WebRTC endpoint to POST its SDP offer to. The real API key never leaves here.
    res.json({
      value: data.value || data.client_secret?.value,
      model: data.session?.model || config.realtimeModel,
      webrtcUrl: config.realtimeCallsUrl,
      expires_at: data.expires_at,
      questionId: question.id || null,
      questionTitle: question.title || null,
      examType,
    })
  } catch (err) {
    console.error('Realtime session exception:', err)
    res.status(500).json({ error: 'Internal error creating realtime session' })
  }
})

/* ------------------------------------------------------------------ */
/*  Chat — Server-Sent Events streaming text examiner                  */
/*  Body: { messages: [{ role, content }], candidateName?, examType? }  */
/* ------------------------------------------------------------------ */
app.post('/api/chat', async (req, res) => {
  const { messages = [], candidateName, examType } = req.body || {}

  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages must be an array' })
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  const send = (event, payload) =>
    res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)

  // Abort the upstream request if the client disconnects.
  const controller = new AbortController()
  req.on('close', () => controller.abort())

  try {
    const systemPrompt = buildExaminerInstructions({ examType, candidateName, forVoice: false })

    const stream = await openai.chat.completions.create(
      {
        model: config.chatModel,
        stream: true,
        temperature: 0.7,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
            .filter((m) => m && m.role && typeof m.content === 'string')
            .map((m) => ({ role: m.role, content: m.content })),
        ],
      },
      { signal: controller.signal }
    )

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content
      if (delta) send('delta', { text: delta })
    }

    send('done', { ok: true })
    res.end()
  } catch (err) {
    if (controller.signal.aborted) return // client left; nothing to do
    console.error('Chat stream error:', err)
    send('error', { message: 'The examiner could not respond. Please try again.' })
    res.end()
  }
})

/* ------------------------------------------------------------------ */
/*  Feedback — grade a finished session transcript and return JSON      */
/*  Body: { transcript: [{ role, text }], examType? }                   */
/* ------------------------------------------------------------------ */
app.post('/api/feedback', async (req, res) => {
  const { transcript = [], examType = 'RACGP', questionId, durationSec = 0, save = true } = req.body || {}

  try {
    const dbQuestion = questionId ? await getQuestionById(questionId) : null
    const question = normalizeQuestion(dbQuestion)

    const systemPrompt = buildExaminerInstructions({ examType, forVoice: false, question })
    const userPrompt = buildFeedbackUserPrompt(transcript)

    const completion = await openai.chat.completions.create({
      model: config.chatModel,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })

    let data
    try {
      data = JSON.parse(completion.choices?.[0]?.message?.content || '{}')
    } catch {
      data = {}
    }

    const report = buildReport(data)

    // Persist (best-effort; never blocks the response on a DB error)
    let sessionId = null
    if (save) {
      const list = Array.isArray(transcript) ? transcript : []
      const wordCount = list.reduce((n, t) => n + String(t.text || '').split(/\s+/).filter(Boolean).length, 0)
      const questionsAnswered = list.filter((t) => t.role === 'examiner').length
      const saved = await saveSession({
        questionId: question.id || null,
        examType,
        durationSec,
        questionsAnswered,
        wordCount,
        feedback: {
          score: report.score, // 0-100
          result: report.result,
          summary: report.examiner_comments,
          strengths: report.strengths,
          improvements: report.weaknesses,
        },
        transcript,
      })
      sessionId = saved?.id || null
    }

    res.json({ ...report, sessionId })
  } catch (err) {
    console.error('Feedback error:', err)
    res.json(FEEDBACK_FALLBACK)
  }
})

/* Build the scored report from the model's JSON (scores are 0-10). */
function buildReport(data) {
  const s = (v, fb = 6) => clampInt(v, 0, 10, fb)
  const dr = s(data.clinical_reasoning)
  const dx = s(data.diagnosis)
  const mg = s(data.management)
  const co = s(data.communication)
  const overall = s(data.overall_score, Math.round((dr + dx + mg + co) / 4))
  const result = band10(overall)

  return {
    // ---- exact production JSON schema (0-10) ----
    overall_score: overall,
    clinical_reasoning: dr,
    diagnosis: dx,
    management: mg,
    communication: co,
    strengths: arr(data.strengths),
    weaknesses: arr(data.weaknesses),
    recommendations: arr(data.recommendations),
    examiner_comments: str(data.examiner_comments),
    // ---- derived fields for charts / report / DB (0-100) ----
    score: overall * 10,
    result,
    detailedFeedback: str(data.examiner_comments),
    improvements: arr(data.weaknesses),
    domains: [
      { name: 'Clinical Reasoning', score: dr * 10, comment: '' },
      { name: 'Diagnosis', score: dx * 10, comment: '' },
      { name: 'Management', score: mg * 10, comment: '' },
      { name: 'Communication', score: co * 10, comment: '' },
    ],
  }
}

function band10(v) {
  if (v >= 9) return 'Excellent'
  if (v >= 7) return 'Competent'
  if (v >= 5) return 'Borderline Pass'
  return 'Needs Significant Improvement'
}

const FEEDBACK_FALLBACK = {
  overall_score: 6, clinical_reasoning: 6, diagnosis: 6, management: 6, communication: 6,
  strengths: [], weaknesses: [], recommendations: [],
  examiner_comments: 'The session was assessed automatically; a detailed breakdown was unavailable.',
  score: 60, result: 'Borderline Pass',
  detailedFeedback: 'The session was assessed automatically; a detailed breakdown was unavailable.',
  improvements: [],
  domains: [
    { name: 'Clinical Reasoning', score: 60 },
    { name: 'Diagnosis', score: 60 },
    { name: 'Management', score: 60 },
    { name: 'Communication', score: 60 },
  ],
}

function clampInt(v, min, max, fallback) {
  const n = Math.round(Number(v))
  if (Number.isNaN(n)) return fallback
  return Math.max(min, Math.min(max, n))
}
function str(v) {
  return typeof v === 'string' ? v : ''
}
function arr(v) {
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : []
}

/* ------------------------------------------------------------------ */
app.use((_req, res) => res.status(404).json({ error: 'Not found' }))

app.listen(config.port, () => {
  console.log(`\n  PassGP server running on http://localhost:${config.port}`)
  console.log(`  Chat model:     ${config.chatModel}`)
  console.log(`  Realtime model: ${config.realtimeModel}`)
  console.log(`  Voice:          ${config.voice}\n`)
})
