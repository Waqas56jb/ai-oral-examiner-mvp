import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import OpenAI from 'openai'

import { config, getApiKey } from './config.js'
import {
  buildExaminerInstructions,
  buildPoolInstructions,
  buildGraderSystem,
  buildFeedbackUserPrompt,
  normalizeQuestion,
  SAMPLE_CASE,
} from './prompts/examiner.js'
import { getRandomQuestion, getQuestionById, getTrainingPool, saveSession } from './db/repo.js'
import { parseClinicalCase, jotformReady, listCaseForms, deriveExamType } from './integrations/jotform.js'
import { supabase } from './db/supabase.js'

/**
 * Resolve the case to examine on, from any source:
 *  - formId   -> live Jotform clinical case  (preferred when provided)
 *  - questionId -> a specific DB question
 *  - else     -> a random DB question for the exam type (fallback: sample case)
 */
async function resolveCase({ formId, questionId, examType }) {
  if (formId && jotformReady()) {
    try {
      return await parseClinicalCase(formId)
    } catch (err) {
      console.error('Jotform case fetch failed, falling back:', err.message)
    }
  }
  if (questionId) return getQuestionById(questionId)
  return getRandomQuestion(examType)
}

const apiKey = getApiKey()
const openai = new OpenAI({ apiKey })

/* ---- OpenAI fallback key (admin-set, used when the primary fails/quota) ---- */
let _fbCache = { key: null, at: 0 }
async function getFallbackKey() {
  try {
    if (!supabase) return null
    if (Date.now() - _fbCache.at < 60_000) return _fbCache.key
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'openai_fallback').maybeSingle()
    _fbCache = { key: data?.value?.key || null, at: Date.now() }
    return _fbCache.key
  } catch {
    return null
  }
}
// Voice chosen by the admin (AI Config), falling back to the code default.
let _voiceCache = { v: null, at: 0 }
async function activeVoice() {
  try {
    if (!supabase) return config.voice
    if (Date.now() - _voiceCache.at < 60_000 && _voiceCache.v) return _voiceCache.v
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'ai_config').maybeSingle()
    _voiceCache = { v: data?.value?.voice || config.voice, at: Date.now() }
    return _voiceCache.v
  } catch {
    return config.voice
  }
}
function isQuotaOrAuth(e, status) {
  const s = status ?? e?.status ?? e?.response?.status
  return s === 429 || s === 401 || /quota|rate.?limit|insufficient|exceeded|billing/i.test(e?.message || '')
}
// Chat completion that transparently retries on the fallback key.
async function chatCreate(params, options) {
  try {
    return await openai.chat.completions.create(params, options)
  } catch (e) {
    if (!isQuotaOrAuth(e)) throw e
    const fk = await getFallbackKey()
    if (!fk) throw e
    console.warn('OpenAI primary key failed — retrying with admin fallback key.')
    return await new OpenAI({ apiKey: fk }).chat.completions.create(params, options)
  }
}

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
    case: SAMPLE_CASE.external_ref,
  })
})

// Public: the admin-selected voice-agent widget theme (for the client widget)
app.get('/api/widget-theme', async (_req, res) => {
  try {
    if (!supabase) return res.json({ template: 'cosmic' })
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'widget_theme').maybeSingle()
    res.json({ template: data?.value?.template || 'cosmic' })
  } catch {
    res.json({ template: 'cosmic' })
  }
})

const MAINTENANCE_MSG =
  'Our AI examiner is currently being updated with new exam cases and is briefly unavailable. Please check back again shortly — thank you for your patience! 🙏'

/* ------------------------------------------------------------------ */
/*  Realtime voice — mint a short-lived ephemeral token                */
/*  The browser uses this token to open a WebRTC connection directly   */
/*  to OpenAI. The real OPENAI_API_KEY never leaves this server.        */
/* ------------------------------------------------------------------ */
app.post('/api/realtime/session', async (req, res) => {
  try {
    const { candidateName, examType = '', questionId, formId } = req.body || {}

    let instructions
    let meta
    if (formId || questionId) {
      // Explicit single case (e.g. a per-page Jotform/case embed)
      const rawCase = await resolveCase({ formId, questionId, examType })
      if (!rawCase) return res.status(409).json({ maintenance: true, error: MAINTENANCE_MSG })
      const question = normalizeQuestion(rawCase)
      instructions = buildExaminerInstructions({ examType: question.examType, candidateName, forVoice: true, question: rawCase })
      meta = {
        questionId: question.source === 'db' ? question.id : null,
        formId: formId || null,
        questionTitle: question.title || null,
        examType: question.examType,
        categories: [],
      }
    } else {
      // Adaptive, category-aware session across the whole training set:
      // the examiner knows the available areas and runs the candidate's choice.
      const pool = await getTrainingPool()
      if (!pool.cases.length) return res.status(409).json({ maintenance: true, error: MAINTENANCE_MSG })
      instructions = buildPoolInstructions({ categories: pool.categories, cases: pool.cases, candidateName, forVoice: true })
      meta = { questionId: null, formId: null, questionTitle: 'Adaptive training session', examType: '', categories: pool.categories }
    }

    const sessionBody = JSON.stringify({
      session: {
        type: 'realtime',
        model: config.realtimeModel,
        instructions,
        audio: {
          input: {
            transcription: { model: config.transcriptionModel },
            // Filter out background noise before it reaches the model.
            noise_reduction: { type: 'near_field' },
            // Server VAD tuned for natural conversation:
            //  - silence_duration 800ms → patient with the candidate's pauses
            //  - interrupt_response: true → the candidate can naturally INTERRUPT
            //    and talk over the examiner (#21). Echo cancellation on the mic
            //    keeps the examiner from interrupting itself.
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 800,
              create_response: true,
              interrupt_response: true,
            },
          },
          output: { voice: await activeVoice(), speed: 1.0 },
        },
      },
    })

    const mint = (key) =>
      fetch(config.realtimeClientSecretsUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: sessionBody,
      })

    let response = await mint(apiKey)
    if (!response.ok && (response.status === 401 || response.status === 429)) {
      const fk = await getFallbackKey()
      if (fk) {
        console.warn('Realtime primary key failed — using admin fallback key.')
        response = await mint(fk)
      }
    }

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
      ...meta,
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

    const stream = await chatCreate(
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
  const { transcript = [], examType = '', questionId, formId, durationSec = 0, save = true } = req.body || {}

  try {
    const rawCase = questionId || formId ? await resolveCase({ formId, questionId, examType }) : null
    const question = normalizeQuestion(rawCase)

    // Single-case sessions grade against the case; adaptive sessions grade from the transcript.
    const systemPrompt = rawCase
      ? buildExaminerInstructions({ examType, forVoice: false, question: rawCase })
      : buildGraderSystem()
    const userPrompt = buildFeedbackUserPrompt(transcript)

    const completion = await chatCreate({
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
        questionId: rawCase ? question.id || null : null,
        examType: (rawCase ? question.examType : examType) || 'General',
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
/*  ADMIN — protected endpoints (Supabase JWT + admin_users check)      */
/* ------------------------------------------------------------------ */
async function requireAdmin(req, res, next) {
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase not configured' })
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    if (!token) return res.status(401).json({ error: 'Unauthorized' })
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data?.user) return res.status(401).json({ error: 'Invalid session' })
    const { data: adminRow } = await supabase.from('admin_users').select('id').eq('id', data.user.id).maybeSingle()
    if (!adminRow) return res.status(403).json({ error: 'Not an administrator' })
    req.adminUser = data.user
    next()
  } catch {
    res.status(500).json({ error: 'Auth check failed' })
  }
}

// List ALL Jotform clinical case forms available to import (paginated → thousands)
app.get('/api/admin/jotform/forms', requireAdmin, async (_req, res) => {
  try {
    const cases = await listCaseForms()
    res.json({ forms: cases, total: cases.length })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Import a BATCH of forms into the question bank.
// Body: { forms: [{ id, title }] }  (preferred) or { formIds: [] }
// The admin UI sends small batches and loops to import the whole bank.
app.post('/api/admin/jotform/import', requireAdmin, async (req, res) => {
  try {
    let batch = []
    if (Array.isArray(req.body?.forms)) {
      batch = req.body.forms.map((f) => ({ id: String(f.id), title: f.title }))
    } else if (Array.isArray(req.body?.formIds)) {
      batch = req.body.formIds.map((id) => ({ id: String(id), title: null }))
    }
    batch = batch.slice(0, 60) // safety cap per request (avoids serverless timeout)

    let imported = 0
    let updated = 0
    let failed = 0
    for (const { id, title } of batch) {
      try {
        const c = await parseClinicalCase(id, title)
        if (!c.scenario) {
          failed++
          continue
        }
        const row = {
          exam_type: deriveExamType(c.category, c.title),
          external_ref: id,
          title: c.title,
          stem: c.scenario,
          marking_criteria: c.questions,
          is_active: true,
        }
        const existing = await supabase.from('exam_questions').select('id').eq('external_ref', id).maybeSingle()
        if (existing.data?.id) {
          await supabase.from('exam_questions').update(row).eq('id', existing.data.id)
          await supabase.from('exam_questions').update({ model_answer: c.modelAnswers.join('\n\n') }).eq('id', existing.data.id)
          updated++
        } else {
          const ins = await supabase.from('exam_questions').insert(row).select('id').single()
          if (ins.error) {
            failed++
          } else {
            await supabase.from('exam_questions').update({ model_answer: c.modelAnswers.join('\n\n') }).eq('id', ins.data.id)
            imported++
          }
        }
      } catch {
        failed++
      }
    }
    res.json({ imported, updated, failed, total: batch.length })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Admin: full question list (light fields) — service key, returns ALL rows
app.get('/api/admin/questions', requireAdmin, async (_req, res) => {
  try {
    let all = []
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('exam_questions')
        .select('id, title, exam_type, in_training, is_active')
        .order('title')
        .range(from, from + 999)
      if (error) return res.status(500).json({ error: error.message })
      all = all.concat(data || [])
      if (!data || data.length < 1000) break
      from += 1000
    }
    res.json({ questions: all, total: all.length })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Admin: push/remove a batch of cases into/out of the training set (persists via service key)
app.post('/api/admin/training/set', requireAdmin, async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : []
    const value = Boolean(req.body?.in_training)
    if (!ids.length) return res.json({ updated: 0 })
    let updated = 0
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500)
      const { data, error } = await supabase.from('exam_questions').update({ in_training: value }).in('id', chunk).select('id')
      if (error) return res.status(500).json({ error: error.message })
      updated += data?.length || 0
    }
    res.json({ updated })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/* ------------------------------------------------------------------ */
/*  ADMIN — self-service password reset (no email link)                */
/*  Step 1: check the email belongs to an admin                        */
/*  Step 2: set a new password directly (service role)                 */
/* ------------------------------------------------------------------ */
async function findAdminByEmail(email) {
  if (!supabase || !email) return null
  const { data } = await supabase.from('admin_users').select('id, email').ilike('email', email.trim()).maybeSingle()
  return data || null
}

app.post('/api/admin/auth/check-email', async (req, res) => {
  try {
    const admin = await findAdminByEmail(req.body?.email)
    res.json({ exists: Boolean(admin) })
  } catch {
    res.json({ exists: false })
  }
})

app.post('/api/admin/auth/reset-password', async (req, res) => {
  try {
    const { email, password } = req.body || {}
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })
    if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })

    const admin = await findAdminByEmail(email)
    if (!admin) return res.status(404).json({ error: 'No administrator account found for that email' })

    const { error } = await supabase.auth.admin.updateUserById(admin.id, { password })
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/* ------------------------------------------------------------------ */
app.use((_req, res) => res.status(404).json({ error: 'Not found' }))

app.listen(config.port, () => {
  console.log(`\n  PassGP server running on http://localhost:${config.port}`)
  console.log(`  Chat model:     ${config.chatModel}`)
  console.log(`  Realtime model: ${config.realtimeModel}`)
  console.log(`  Voice:          ${config.voice}\n`)
})
