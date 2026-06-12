import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import OpenAI from 'openai'

import { config, getApiKey } from './config.js'
import { buildExaminerInstructions, SAMPLE_CASE } from './prompts/examiner.js'

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
    const { candidateName, examType } = req.body || {}

    const instructions = buildExaminerInstructions({
      examType,
      candidateName,
      forVoice: true,
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
  try {
    const { transcript = [], examType } = req.body || {}

    const convo = (Array.isArray(transcript) ? transcript : [])
      .map((t) => `${t.role === 'examiner' ? 'EXAMINER' : 'CANDIDATE'}: ${t.text}`)
      .join('\n')

    const systemPrompt = buildExaminerInstructions({ examType, forVoice: false })

    const completion = await openai.chat.completions.create({
      model: config.chatModel,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content:
            `The oral exam has ended. Assess the CANDIDATE based only on the transcript below. ` +
            `Respond with a JSON object using exactly these keys: ` +
            `"confidence" (integer 0-100, your confidence in the candidate's overall performance), ` +
            `"score" (integer 0-100), "result" (one of "Clear pass","Borderline","Below standard"), ` +
            `"summary" (1-2 sentences), "strengths" (array of short strings), ` +
            `"improvements" (array of short strings).\n\nTRANSCRIPT:\n${convo || '(no transcript captured)'}`,
        },
      ],
    })

    let data
    try {
      data = JSON.parse(completion.choices?.[0]?.message?.content || '{}')
    } catch {
      data = {}
    }

    res.json({
      confidence: clampInt(data.confidence, 0, 100, 75),
      score: clampInt(data.score, 0, 100, 75),
      result: data.result || 'Borderline',
      summary: data.summary || '',
      strengths: Array.isArray(data.strengths) ? data.strengths : [],
      improvements: Array.isArray(data.improvements) ? data.improvements : [],
    })
  } catch (err) {
    console.error('Feedback error:', err)
    // Safe fallback so the report still renders
    res.json({ confidence: 75, score: 75, result: 'Borderline', summary: '', strengths: [], improvements: [] })
  }
})

function clampInt(v, min, max, fallback) {
  const n = Math.round(Number(v))
  if (Number.isNaN(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

/* ------------------------------------------------------------------ */
app.use((_req, res) => res.status(404).json({ error: 'Not found' }))

app.listen(config.port, () => {
  console.log(`\n  PassGP server running on http://localhost:${config.port}`)
  console.log(`  Chat model:     ${config.chatModel}`)
  console.log(`  Realtime model: ${config.realtimeModel}`)
  console.log(`  Voice:          ${config.voice}\n`)
})
