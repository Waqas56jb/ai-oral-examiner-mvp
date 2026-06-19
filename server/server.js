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
  buildMarksFeedbackPrompt,
  buildExamMarksFeedbackPrompt,
  buildExamSessionInstructions,
  normalizeQuestion,
} from './prompts/examiner.js'
import {
  getRandomQuestion, getQuestionById, getTrainingPool, getCircuit, saveSession,
  getCandidateExams, getExamProfile, getExamProfilesWithCounts, getExamCases, canonicalExam,
} from './db/repo.js'
import { sendSessionSummary } from './email.js'
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
// AI config chosen by the admin (voice + models), cached, with code fallbacks.
let _cfgCache = { v: null, at: 0 }
async function getAIConfig() {
  try {
    if (!supabase) return {}
    if (Date.now() - _cfgCache.at < 60_000 && _cfgCache.v) return _cfgCache.v
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'ai_config').maybeSingle()
    _cfgCache = { v: data?.value || {}, at: Date.now() }
    return _cfgCache.v
  } catch {
    return {}
  }
}
async function activeVoice() {
  return (await getAIConfig()).voice || config.voice
}
async function activeRealtimeModel() {
  return (await getAIConfig()).realtimeModel || config.realtimeModel
}
async function activeChatModel() {
  return (await getAIConfig()).chatModel || config.chatModel
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
// Larger limit so the client can POST the rendered report PDF (base64) to email.
app.use(express.json({ limit: '15mb' }))
// Our own Vercel deployments (admin / chatbot / backend) — old, new and preview
// aliases all share this prefix. Matching the pattern avoids "Load failed" when
// a deployment URL changes.
const OWN_VERCEL = /^https:\/\/ai-oral[a-z0-9-]*\.vercel\.app$/
app.use(
  cors({
    origin(origin, cb) {
      // No Origin header → non-browser caller (curl, server-to-server, health
      // checks). These can't be used for browser CSRF, so allow them.
      if (!origin) return cb(null, true)
      const clean = origin.replace(/\/$/, '')
      if (config.allowedOrigins.includes(clean) || OWN_VERCEL.test(clean)) return cb(null, true)
      // Disallowed browser origin → block (no CORS headers sent).
      return cb(null, false)
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

// Public: exams a candidate can choose (those with trained cases). Drives the
// candidate registration "exam type" dropdown.
app.get('/api/exam-profiles', async (_req, res) => {
  try {
    const exams = await getCandidateExams()
    res.json({ exams })
  } catch {
    res.json({ exams: [] })
  }
})

// Public: email the candidate the EXACT on-screen report (with charts) that the
// client rendered to PDF. Body: { candidateEmail, candidateName, examType, pdfBase64, report }.
app.post('/api/email-report', async (req, res) => {
  try {
    const { candidateEmail, candidateName = '', examType = '', pdfBase64 = '', report = {} } = req.body || {}
    if (!candidateEmail) return res.json({ sent: false, reason: 'no recipient' })
    let pdfBuffer = null
    if (pdfBase64) {
      const b64 = String(pdfBase64).replace(/^data:application\/pdf(;[^,]*)?,/, '')
      pdfBuffer = Buffer.from(b64, 'base64')
    }
    const result = await sendSessionSummary({ candidateEmail, candidateName, examType, report, pdfBuffer })
    res.json(result)
  } catch (e) {
    console.error('email-report error:', e?.message)
    res.json({ sent: false, reason: e?.message || 'error' })
  }
})

// Public: a candidate's own past sessions, looked up by the email they registered
// with. Returns their attempt history (scores, pass/fail, feedback) — no transcript.
app.get('/api/candidate/history', async (req, res) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase()
    if (!email || !supabase) return res.json({ sessions: [] })
    const { data } = await supabase
      .from('exam_sessions')
      .select('id, created_at, candidate_name, exam_type, pathway, case_title, duration_sec, score, score_override, pass_fail, result, marks_awarded, total_marks, killer_failed, summary, strengths, improvements, missed_items, unsafe_areas')
      .ilike('candidate_email', email)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(200)
    res.json({ sessions: data || [] })
  } catch {
    res.json({ sessions: [] })
  }
})

const MAINTENANCE_MSG =
  'Our AI examiner is currently being updated with new exam cases and is briefly unavailable. Please check back again shortly — thank you for your patience! 🙏'

/* ------------------------------------------------------------------ */
/*  Realtime voice — mint a short-lived ephemeral token                */
/*  The browser uses this token to open a WebRTC connection directly   */
/*  to OpenAI. The real OPENAI_API_KEY never leaves this server.        */
/* ------------------------------------------------------------------ */
/* Generate a mock-exam circuit of sequential stations (#10/#16). */
app.get('/api/mock/circuit', async (req, res) => {
  try {
    const count = req.query.count || 3
    const pathway = req.query.pathway || ''
    const examType = req.query.exam || req.query.examType || ''
    const stations = await getCircuit({ count, pathway, examType })
    if (!stations.length) return res.status(409).json({ maintenance: true, error: MAINTENANCE_MSG, stations: [] })
    res.json({ stations })
  } catch (err) {
    console.error('Circuit error:', err)
    res.status(500).json({ error: 'Could not generate a mock exam circuit.' })
  }
})

app.post('/api/realtime/session', async (req, res) => {
  try {
    const { candidateName, examType = '', questionId, formId } = req.body || {}

    const aiConfig = await getAIConfig()
    // Admin can lock the examiner to a single exam area (#2).
    const focusExam = (aiConfig.focusExam || '').trim()

    let instructions
    let meta
    if (formId || questionId) {
      // Explicit single case (e.g. a per-page Jotform/case embed)
      const rawCase = await resolveCase({ formId, questionId, examType })
      if (!rawCase) return res.status(409).json({ maintenance: true, error: MAINTENANCE_MSG })
      const question = normalizeQuestion(rawCase)
      instructions = buildExaminerInstructions({ examType: question.examType, candidateName, forVoice: true, question: rawCase, aiConfig })
      meta = {
        questionId: question.source === 'db' ? question.id : null,
        formId: formId || null,
        questionTitle: question.title || null,
        examType: question.examType,
        categories: [],
        durationSeconds: Number(rawCase.duration_seconds) > 0 ? Number(rawCase.duration_seconds) : 480,
      }
    } else {
      // The candidate has chosen an EXAM (e.g. RACGP CCE / StAMPS). Run an
      // exam session with that exam's personality and a "pick a case number"
      // menu (George's flow). Admin focusExam can force the exam.
      const chosenExam = (focusExam || examType || '').trim()
      const examCases = chosenExam ? await getExamCases(chosenExam) : []
      if (chosenExam && examCases.length) {
        const profile = await getExamProfile(chosenExam)
        instructions = buildExamSessionInstructions({ exam: chosenExam, profile, cases: examCases, candidateName, forVoice: true, aiConfig })
        meta = {
          questionId: null, formId: null,
          questionTitle: `${profile?.label || chosenExam} exam`,
          examType: chosenExam,
          categories: [], durationSeconds: 900,
        }
      } else {
        // Fallback: adaptive, category-aware session across the whole training set.
        const pool = await getTrainingPool(16, focusExam || '')
        if (!pool.cases.length) return res.status(409).json({ maintenance: true, error: MAINTENANCE_MSG })
        instructions = buildPoolInstructions({ categories: pool.categories, cases: pool.cases, candidateName, forVoice: true, aiConfig })
        meta = { questionId: null, formId: null, questionTitle: 'Adaptive training session', examType: focusExam || '', categories: pool.categories, durationSeconds: 900 }
      }
    }

    const sessionBody = JSON.stringify({
      session: {
        type: 'realtime',
        model: await activeRealtimeModel(),
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
    const systemPrompt = buildExaminerInstructions({ examType, candidateName, forVoice: false, aiConfig: await getAIConfig() })

    const stream = await chatCreate(
      {
        model: await activeChatModel(),
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
  const { transcript = [], examType = '', questionId, formId, durationSec = 0, save = true,
          candidateName = '', candidateEmail = '', pathway = '' } = req.body || {}

  try {
    const rawCase = questionId || formId ? await resolveCase({ formId, questionId, examType }) : null
    const question = normalizeQuestion(rawCase)

    // Grading strategy (always against the case's OWN marking scheme — never /10):
    //  1) Single case (formId/questionId) → mark against that case.
    //  2) Exam session (examType is an exam) → mark against whichever of the
    //     exam's cases the candidate chose (grader identifies it).
    //  3) Otherwise → qualitative.
    let userPrompt
    let examCases = null
    if (rawCase) {
      userPrompt = buildMarksFeedbackPrompt(transcript, question)
    } else if (examType && (examCases = await getExamCases(examType)).length) {
      const examProfile = await getExamProfile(examType)
      userPrompt = buildExamMarksFeedbackPrompt(transcript, examCases, examProfile)
    } else {
      examCases = null
      userPrompt = buildFeedbackUserPrompt(transcript)
    }

    const completion = await chatCreate({
      model: await activeChatModel(),
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildGraderSystem() },
        { role: 'user', content: userPrompt },
      ],
    })

    let data
    try {
      data = JSON.parse(completion.choices?.[0]?.message?.content || '{}')
    } catch {
      data = {}
    }

    const report = buildReport(data, rawCase ? question : null)

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
        candidateName: (candidateName && candidateName.trim()) || report.candidate_name || null,
        candidateEmail: (candidateEmail && candidateEmail.trim()) || null,
        pathway: (pathway && pathway.trim()) || (rawCase ? question.pathway : '') || null,
        formId: formId || null,
        caseTitle: rawCase ? question.title : null,
        feedback: {
          score: report.score, // 0-100
          result: report.result,
          pass_fail: report.pass_fail,
          summary: report.examiner_comments,
          strengths: report.strengths,
          improvements: report.weaknesses,
          missed_items: report.missed_items,
          unsafe_areas: report.unsafe_areas,
          marks_awarded: report.marks_awarded,
          total_marks: report.total_marks,
          killer_failed: report.killer_failed,
        },
        transcript,
      })
      sessionId = saved?.id || null

      // NOTE: the candidate's emailed report is sent from the client report page
      // (POST /api/email-report) so it includes the exact on-screen charts/graphs.
    }

    res.json({ ...report, sessionId })
  } catch (err) {
    console.error('Feedback error:', err)
    res.json(FEEDBACK_FALLBACK)
  }
})

/* Build the scored report from the model's JSON.
 * If `caseObj` is given, use its marking scheme (total/pass marks, killer marks);
 * otherwise fall back to qualitative 0-10 domain scoring. */
function buildReport(data, caseObj = null) {
  const s = (v, fb = 6) => clampInt(v, 0, 10, fb)
  const dr = s(data.clinical_reasoning)
  const dx = s(data.diagnosis)
  const mg = s(data.management)
  const co = s(data.communication)

  // ---- Marks-based result (#6) ----
  // Use marks mode when we have a case OR the grader returned a marks total
  // (exam sessions return the matched case's total). Never a generic /10.
  const marksMode = Boolean(caseObj) || Number(data.total_marks) > 0
  let overall, scorePct, passFail, marksAwarded = null, totalMarks = null, passMark = null, killerFailed = false
  if (marksMode) {
    totalMarks = Number(data.total_marks) > 0 ? Number(data.total_marks) : (Number(caseObj?.totalMarks) || 10)
    passMark = data.pass_mark != null ? Number(data.pass_mark)
      : (caseObj?.passMark != null ? Number(caseObj.passMark) : Math.ceil(totalMarks / 2))
    marksAwarded = clampInt(data.marks_awarded, 0, totalMarks, 0)
    killerFailed = Boolean(data.killer_failed)
    scorePct = totalMarks > 0 ? Math.round((marksAwarded / totalMarks) * 100) : 0
    overall = Math.round(scorePct / 10)
    passFail = killerFailed ? 'Fail' : (marksAwarded >= passMark ? 'Pass' : 'Fail')
  } else {
    overall = s(data.overall_score, Math.round((dr + dx + mg + co) / 4))
    scorePct = overall * 10
    passFail = /fail/i.test(String(data.pass_fail)) ? 'Fail' : overall >= 5 ? 'Pass' : 'Fail'
  }
  const result = killerFailed ? 'Unsafe — Critical Fail' : band10(overall)

  return {
    // ---- exact production JSON schema (0-10) ----
    candidate_name: str(data.candidate_name),
    overall_score: overall,
    clinical_reasoning: dr,
    diagnosis: dx,
    management: mg,
    communication: co,
    pass_fail: passFail,
    strengths: arr(data.strengths),
    weaknesses: arr(data.weaknesses),
    missed_items: arr(data.missed_items),
    unsafe_areas: arr(data.unsafe_areas),
    recommendations: arr(data.recommendations),
    examiner_comments: str(data.examiner_comments),
    // ---- marking detail (#6) ----
    marks_awarded: marksAwarded,
    total_marks: totalMarks,
    pass_mark: passMark,
    killer_failed: killerFailed,
    rubric_breakdown: Array.isArray(data.rubric_breakdown) ? data.rubric_breakdown : [],
    // ---- derived fields for charts / report / DB (0-100) ----
    score: scorePct,
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
        // Marking comes from the case's OWN scheme (real total, not /10).
        const total = Number(c.total_marks) > 0 ? Number(c.total_marks) : (c.questions?.length || 1)
        const row = {
          exam_type: deriveExamType(c.category, c.title),
          external_ref: id,
          title: c.title,
          stem: c.scenario,
          marking_criteria: Array.isArray(c.marking_criteria) && c.marking_criteria.length ? c.marking_criteria : c.questions,
          model_answer: (c.modelAnswers || []).join('\n\n') || null,
          examiner_instructions: c.questions?.length
            ? 'Work through these questions in order, probing the candidate:\n' + c.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')
            : null,
          total_marks: total,
          pass_mark: c.pass_mark != null ? c.pass_mark : Math.max(1, Math.round(total * 0.5)),
          is_active: true,
        }
        const existing = await supabase.from('exam_questions').select('id').eq('external_ref', id).maybeSingle()
        if (existing.data?.id) {
          const { error } = await supabase.from('exam_questions').update(row).eq('id', existing.data.id)
          error ? failed++ : updated++
        } else {
          const ins = await supabase.from('exam_questions').insert(row).select('id').single()
          ins.error ? failed++ : imported++
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
        .select('id, title, exam_type, pathway, in_training, is_active, status')
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

// Admin: list exam profiles with their (active) case counts.
app.get('/api/admin/exam-profiles', requireAdmin, async (_req, res) => {
  try {
    const rows = await getExamProfilesWithCounts()
    res.json({ profiles: rows.map((p) => ({
      exam_key: p.exam_key,
      label: p.label || p.exam_key,
      examiner_instructions: p.examiner_instructions || '',
      mark_scheme: p.mark_scheme || '',
      standard: p.standard || '',
      mode: p.mode || 'both',
      enabled: p.enabled ?? true,
      caseCount: p.caseCount || 0,
    })) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Admin: create/update an exam profile (upsert by exam_key).
app.put('/api/admin/exam-profiles/:examKey', requireAdmin, async (req, res) => {
  try {
    const exam_key = req.params.examKey
    const { label, examiner_instructions, mode, enabled, mark_scheme, standard } = req.body || {}
    const payload = {
      exam_key,
      label: label ?? exam_key,
      examiner_instructions: examiner_instructions ?? '',
      mark_scheme: mark_scheme ?? '',
      standard: standard ?? '',
      mode: ['both', 'examiner', 'patient'].includes(mode) ? mode : 'both',
      enabled: enabled !== false,
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase.from('exam_profiles').upsert(payload, { onConflict: 'exam_key' }).select('*').single()
    if (error) return res.status(500).json({ error: error.message })
    res.json({ profile: data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Admin: export ALL cases with full fields (for CSV export, #9)
app.get('/api/admin/questions/export', requireAdmin, async (_req, res) => {
  try {
    let all = []
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('exam_questions')
        .select('id, external_ref, title, exam_type, pathway, status, is_active, in_training, candidate_instructions, stem, patient_script, marking_criteria, model_answer, examiner_instructions, red_flags, killer_marks, feedback_points, total_marks, pass_mark, duration_seconds')
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

// Admin: BULK upsert cases from a CSV import (#9).
// Body: { rows: [{ ...case fields, external_ref? }] }. Matches on external_ref
// when present, otherwise on exact title; inserts when no match.
app.post('/api/admin/questions/bulk', requireAdmin, async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : []
    if (!rows.length) return res.json({ inserted: 0, updated: 0, failed: 0 })
    let inserted = 0, updated = 0, failed = 0
    for (const raw of rows) {
      try {
        const payload = pickCaseFields(raw)
        if (!payload.title || !payload.stem) { failed++; continue }
        let existing = null
        if (raw.external_ref) {
          existing = (await supabase.from('exam_questions').select('id').eq('external_ref', raw.external_ref).maybeSingle()).data
        }
        if (!existing) {
          existing = (await supabase.from('exam_questions').select('id').eq('title', payload.title).maybeSingle()).data
        }
        if (existing?.id) {
          const { error } = await supabase.from('exam_questions').update(payload).eq('id', existing.id)
          if (error) { failed++; continue }
          updated++
        } else {
          const ins = { ...payload }
          if (raw.external_ref) ins.external_ref = raw.external_ref
          const { error } = await supabase.from('exam_questions').insert(ins)
          if (error) { failed++; continue }
          inserted++
        }
      } catch {
        failed++
      }
    }
    res.json({ inserted, updated, failed, total: rows.length })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Admin: fetch ONE full case (for the editor)
app.get('/api/admin/questions/:id', requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase.from('exam_questions').select('*').eq('id', req.params.id).maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    if (!data) return res.status(404).json({ error: 'Case not found' })
    res.json({ question: data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Whitelist of columns an admin may write (prevents arbitrary column injection).
const CASE_FIELDS = [
  'title', 'exam_type', 'pathway', 'candidate_instructions', 'stem', 'patient_script',
  'marking_criteria', 'model_answer', 'examiner_instructions', 'red_flags', 'feedback_points',
  'total_marks', 'pass_mark', 'duration_seconds', 'killer_marks', 'status', 'is_active', 'in_training',
]
function pickCaseFields(body = {}) {
  const out = {}
  for (const k of CASE_FIELDS) if (k in body) out[k] = body[k]
  return out
}

// Admin: CREATE a case
app.post('/api/admin/questions', requireAdmin, async (req, res) => {
  try {
    const payload = pickCaseFields(req.body)
    if (!payload.title || !payload.stem) return res.status(400).json({ error: 'Title and scenario are required' })
    const { data, error } = await supabase.from('exam_questions').insert(payload).select('*').single()
    if (error) return res.status(500).json({ error: error.message })
    res.json({ question: data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Admin: UPDATE / EDIT a case (also used for activate/deactivate/status via PATCH)
async function updateCase(req, res) {
  try {
    const payload = pickCaseFields(req.body)
    if (!Object.keys(payload).length) return res.status(400).json({ error: 'Nothing to update' })
    const { data, error } = await supabase.from('exam_questions').update(payload).eq('id', req.params.id).select('*').single()
    if (error) return res.status(500).json({ error: error.message })
    res.json({ question: data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
app.put('/api/admin/questions/:id', requireAdmin, updateCase)
app.patch('/api/admin/questions/:id', requireAdmin, updateCase)

// Admin: DELETE a case
app.delete('/api/admin/questions/:id', requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase.from('exam_questions').delete().eq('id', req.params.id)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Admin: BULK update a field on many cases (e.g. assign them to an exam by
// setting pathway, or change status). Body: { ids: [], patch: {pathway?, exam_type?, status?, ...} }
app.post('/api/admin/questions/bulk-update', requireAdmin, async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : []
    const patch = pickCaseFields(req.body?.patch || {})
    if (!ids.length) return res.json({ updated: 0 })
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nothing to update' })
    // keep is_active in sync when status changes
    if (patch.status && !('is_active' in patch)) patch.is_active = patch.status === 'active'
    let updated = 0
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500)
      const { data, error } = await supabase.from('exam_questions').update(patch).in('id', chunk).select('id')
      if (error) return res.status(500).json({ error: error.message })
      updated += data?.length || 0
    }
    res.json({ updated })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Admin: ASSIGN EXAMS FROM CSV. Body: { rows: [{ ref?, title?, exam }] }.
// Matches each row to a case by Jotform form ID (external_ref) first, else by
// exact title, and sets its exam (pathway = canonical exam name).
app.post('/api/admin/exams/assign-csv', requireAdmin, async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : []
    if (!rows.length) return res.json({ matched: 0, updated: 0, unmatched: [], byExam: {} })

    // Load all cases once (paginated) for matching.
    let cases = []
    let from = 0
    while (true) {
      const { data, error } = await supabase.from('exam_questions').select('id, external_ref, title').range(from, from + 999)
      if (error) return res.status(500).json({ error: error.message })
      cases = cases.concat(data || [])
      if (!data || data.length < 1000) break
      from += 1000
    }
    const byRef = new Map(cases.filter((c) => c.external_ref).map((c) => [String(c.external_ref).trim(), c.id]))
    const byTitle = new Map(cases.filter((c) => c.title).map((c) => [c.title.trim().toLowerCase(), c.id]))

    // Resolve each row → { id, exam }, grouping ids by target exam.
    const byExamIds = new Map()
    const unmatched = []
    for (const r of rows) {
      const exam = canonicalExam(r.exam)
      if (!exam) { unmatched.push({ ...r, reason: 'no exam' }); continue }
      const ref = r.ref != null ? String(r.ref).trim() : ''
      const title = r.title != null ? String(r.title).trim().toLowerCase() : ''
      const id = (ref && byRef.get(ref)) || (title && byTitle.get(title))
      if (!id) { unmatched.push({ ...r, reason: 'case not found' }); continue }
      if (!byExamIds.has(exam)) byExamIds.set(exam, [])
      byExamIds.get(exam).push(id)
    }

    // Apply per exam in chunks.
    let updated = 0
    const byExam = {}
    for (const [exam, ids] of byExamIds) {
      byExam[exam] = ids.length
      for (let i = 0; i < ids.length; i += 500) {
        const chunk = ids.slice(i, i + 500)
        const { data, error } = await supabase.from('exam_questions').update({ pathway: exam }).in('id', chunk).select('id')
        if (error) return res.status(500).json({ error: error.message })
        updated += data?.length || 0
      }
    }
    res.json({ matched: updated, updated, unmatched, byExam })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Admin: BULK delete cases. Body: { ids: [] }
app.post('/api/admin/questions/bulk-delete', requireAdmin, async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : []
    if (!ids.length) return res.json({ deleted: 0 })
    let deleted = 0
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500)
      const { data, error } = await supabase.from('exam_questions').delete().in('id', chunk).select('id')
      if (error) return res.status(500).json({ error: error.message })
      deleted += data?.length || 0
    }
    res.json({ deleted })
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
/*  ADMIN — password reset                                             */
/*  SECURITY: self-service reset uses Supabase's email recovery flow   */
/*  (a one-time link sent to the verified inbox) handled entirely in   */
/*  the admin client. There is deliberately NO endpoint that sets a    */
/*  password from just an email — that was an account-takeover risk.   */
/*                                                                     */
/*  A superadmin CAN reset another admin's password (requires a valid  */
/*  admin session AND superadmin role).                                */
/* ------------------------------------------------------------------ */
app.post('/api/admin/auth/admin-reset-password', requireAdmin, async (req, res) => {
  try {
    // Only a superadmin may reset other admins' passwords.
    const { data: me } = await supabase.from('admin_users').select('role').eq('id', req.adminUser.id).maybeSingle()
    if (me?.role !== 'superadmin') return res.status(403).json({ error: 'Superadmin role required' })

    const { email, password } = req.body || {}
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })
    if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })

    const { data: target } = await supabase.from('admin_users').select('id').ilike('email', String(email).trim()).maybeSingle()
    if (!target) return res.status(404).json({ error: 'No administrator account found for that email' })

    const { error } = await supabase.auth.admin.updateUserById(target.id, { password })
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/* ------------------------------------------------------------------ */
/*  ANALYTICS EXPORT (#14) — flat, Power BI-ready rows                  */
/* ------------------------------------------------------------------ */
function toAnalyticsRow(s) {
  const ai10 = s.score != null ? Math.round(s.score / 10) : ''
  const ov10 = s.score_override != null ? Math.round(s.score_override / 10) : ''
  return {
    session_id: s.id,
    datetime: s.created_at,
    candidate_name: s.candidate_name || '',
    candidate_email: s.candidate_email || '',
    pathway: s.pathway || '',
    category: s.exam_type || '',
    case_id: s.question_id || '',
    form_id: s.form_id || '',
    case_title: s.case_title || '',
    duration_seconds: s.duration_sec || 0,
    duration_minutes: s.duration_sec ? Math.round(s.duration_sec / 60) : 0,
    marks_awarded: s.marks_awarded ?? '',
    total_marks: s.total_marks ?? '',
    score_percent: s.score ?? '',
    ai_score_10: ai10,
    score_override_10: ov10,
    final_pass_fail: s.pass_fail || s.result || '',
    killer_failed: s.killer_failed ? 'yes' : 'no',
    reviewed: s.reviewed ? 'yes' : 'no',
    missed_rubric_items: Array.isArray(s.missed_items) ? s.missed_items.join(' | ') : '',
    unsafe_areas: Array.isArray(s.unsafe_areas) ? s.unsafe_areas.join(' | ') : '',
  }
}

async function fetchAnalyticsRows() {
  if (!supabase) return []
  let all = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('exam_sessions')
      .select('id, created_at, candidate_name, candidate_email, pathway, exam_type, question_id, form_id, case_title, duration_sec, marks_awarded, total_marks, score, score_override, pass_fail, result, killer_failed, reviewed, missed_items, unsafe_areas')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    all = all.concat(data || [])
    if (!data || data.length < 1000) break
    from += 1000
  }
  return all.map(toAnalyticsRow)
}

function rowsToCsv(rows) {
  if (!rows.length) return ''
  const cols = Object.keys(rows[0])
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return [cols.map(esc).join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
}

// Admin (session-authenticated): JSON rows for the in-app export button.
app.get('/api/admin/analytics/export', requireAdmin, async (_req, res) => {
  try {
    const rows = await fetchAnalyticsRows()
    res.json({ rows, total: rows.length })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// API-key protected (for Power BI / external BI tools to pull directly).
// Set the key via ANALYTICS_API_KEY env, or app_settings.analytics_api_key.
async function getAnalyticsKey() {
  if (process.env.ANALYTICS_API_KEY) return process.env.ANALYTICS_API_KEY
  try {
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'analytics_api_key').maybeSingle()
    return data?.value?.key || null
  } catch {
    return null
  }
}
app.get('/api/analytics/export', async (req, res) => {
  try {
    const key = await getAnalyticsKey()
    if (!key) return res.status(503).json({ error: 'Analytics API key not configured' })
    const provided = req.get('x-api-key') || req.query.key
    if (provided !== key) return res.status(401).json({ error: 'Invalid API key' })
    const rows = await fetchAnalyticsRows()
    if ((req.query.format || 'csv') === 'json') return res.json({ rows, total: rows.length })
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="passgp-analytics.csv"')
    res.send(rowsToCsv(rows))
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
