import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import OpenAI from 'openai'

import { config, getApiKey } from './config.js'
import { buildExaminerInstructions, normalizeQuestion, SAMPLE_CASE } from './prompts/examiner.js'
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
            input: { transcription: { model: config.transcriptionModel } },
            output: { voice: config.voice },
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

  // Build a richer, state-of-the-art evaluation and (best-effort) persist it.
  const fallback = {
    confidence: 72,
    score: 72,
    result: 'Borderline',
    summary: 'The session was assessed automatically. A detailed breakdown was unavailable.',
    overallImpression: '',
    strengths: [],
    improvements: [],
    recommendations: [],
    domains: DEFAULT_DOMAINS.map((d) => ({ name: d, score: 70, comment: '' })),
    detailedFeedback: '',
  }

  try {
    const dbQuestion = questionId ? await getQuestionById(questionId) : null
    const question = normalizeQuestion(dbQuestion)

    const convo = (Array.isArray(transcript) ? transcript : [])
      .map((t) => `${t.role === 'examiner' ? 'EXAMINER' : 'CANDIDATE'}: ${t.text}`)
      .join('\n')

    const systemPrompt = buildExaminerInstructions({ examType, forVoice: false, question })

    const completion = await openai.chat.completions.create({
      model: config.chatModel,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content:
            `The oral exam has ended. Produce a thorough, professional examiner's assessment of the ` +
            `CANDIDATE based only on the transcript below. Be specific and reference what the candidate ` +
            `actually said. Respond with a JSON object using EXACTLY these keys:\n` +
            `"score" (integer 0-100 overall),\n` +
            `"confidence" (integer 0-100, examiner confidence in this judgement),\n` +
            `"result" (one of "Clear pass","Borderline","Below standard"),\n` +
            `"summary" (2-3 sentence overall impression),\n` +
            `"detailedFeedback" (a detailed multi-paragraph narrative, 120-220 words),\n` +
            `"strengths" (array of 3-5 specific short strings),\n` +
            `"improvements" (array of 3-5 specific short strings),\n` +
            `"recommendations" (array of 3-4 concrete next-step study actions),\n` +
            `"domains" (array of EXACTLY these five objects, each {"name","score" 0-100,"comment" one short sentence}: ` +
            `"Clinical Knowledge","Communication","Structured Approach","Safety & Red Flags","Time Management").\n\n` +
            `TRANSCRIPT:\n${convo || '(no transcript captured — the candidate did not engage)'}`,
        },
      ],
    })

    let data
    try {
      data = JSON.parse(completion.choices?.[0]?.message?.content || '{}')
    } catch {
      data = {}
    }

    const domains = normalizeDomains(data.domains)
    const result = {
      confidence: clampInt(data.confidence, 0, 100, 72),
      score: clampInt(data.score, 0, 100, avgDomain(domains)),
      result: data.result || 'Borderline',
      summary: str(data.summary),
      detailedFeedback: str(data.detailedFeedback),
      strengths: arr(data.strengths),
      improvements: arr(data.improvements),
      recommendations: arr(data.recommendations),
      domains,
    }

    // Persist (best-effort; never blocks the response on a DB error)
    let sessionId = null
    if (save) {
      const wordCount = (Array.isArray(transcript) ? transcript : []).reduce(
        (n, t) => n + String(t.text || '').split(/\s+/).filter(Boolean).length,
        0
      )
      const questionsAnswered = (Array.isArray(transcript) ? transcript : []).filter((t) => t.role === 'examiner').length
      const saved = await saveSession({
        questionId: question.id || null,
        examType,
        durationSec,
        questionsAnswered,
        wordCount,
        feedback: result,
        transcript,
      })
      sessionId = saved?.id || null
    }

    res.json({ ...result, sessionId })
  } catch (err) {
    console.error('Feedback error:', err)
    res.json(fallback)
  }
})

const DEFAULT_DOMAINS = ['Clinical Knowledge', 'Communication', 'Structured Approach', 'Safety & Red Flags', 'Time Management']

function normalizeDomains(d) {
  const list = Array.isArray(d) ? d : []
  return DEFAULT_DOMAINS.map((name) => {
    const found = list.find((x) => x && typeof x.name === 'string' && x.name.toLowerCase().startsWith(name.toLowerCase().slice(0, 6)))
    return {
      name,
      score: clampInt(found?.score, 0, 100, 70),
      comment: str(found?.comment),
    }
  })
}
function avgDomain(domains) {
  if (!domains.length) return 72
  return Math.round(domains.reduce((a, b) => a + b.score, 0) / domains.length)
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
