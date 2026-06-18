/**
 * Jotform integration (PassGP Enterprise).
 *
 *  READ:  list forms, fetch a clinical case form and parse it into a clean
 *         structure the AI examiner can use (scenario + questions + model answers).
 *  WRITE: create / delete submissions (e.g. to write a candidate's result back),
 *         and create / delete forms (used by the write-capability check).
 *
 * Auth: enterprise API key via ?apiKey=... against the enterprise base URL.
 */

const BASE = process.env.JOTFORM_BASE_URL || 'https://passgp.jotform.com/API'
const KEY = process.env.JOTFORM_API_KEY

export function jotformReady() {
  return Boolean(KEY)
}

async function jf(path, { method = 'GET', body } = {}) {
  if (!KEY) throw new Error('JOTFORM_API_KEY is not set in .env')
  const sep = path.includes('?') ? '&' : '?'
  const url = `${BASE}${path}${sep}apiKey=${encodeURIComponent(KEY)}`
  const opts = { method, headers: { Accept: 'application/json' } }
  if (body) {
    opts.headers['Content-Type'] = 'application/x-www-form-urlencoded'
    opts.body = body
  }
  const r = await fetch(url, opts)
  const json = await r.json().catch(() => null)
  if (!r.ok || (json && typeof json.responseCode === 'number' && json.responseCode >= 400)) {
    throw new Error(`Jotform ${method} ${path} -> ${r.status} ${json?.message || ''}`.trim())
  }
  return json?.content
}

/* ---------------------------------- READ --------------------------------- */

// Fetch ALL forms via pagination (Jotform caps each request at 1000).
export async function listForms({ pageSize = 1000, max = 50000 } = {}) {
  const out = []
  let offset = 0
  while (offset < max) {
    const content = await jf(`/user/forms?limit=${pageSize}&offset=${offset}&orderby=created_at`)
    const batch = content || []
    for (const f of batch) {
      if (f.status !== 'DELETED') {
        out.push({ id: f.id, title: f.title, count: Number(f.count) || 0, status: f.status })
      }
    }
    if (batch.length < pageSize) break
    offset += pageSize
  }
  return out
}

// A clinical case form (e.g. "Case L77", "NZ GP - MCQ- Case B361").
export function isCaseForm(title) {
  return /case\s*[a-z]?\d/i.test(title || '')
}

export async function listCaseForms() {
  const forms = await listForms()
  return forms.filter((f) => isCaseForm(f.title))
}

// Derive a clinical category / exam tag from the case category/title.
// IMPORTANT: never guess an exam — if there's no clear label, return 'Unassigned'
// so PassGP assigns the correct exam explicitly (the Jotform forms do NOT reliably
// carry the exam name). Falsely defaulting to RACGP is what made CCE inaccurate.
export function deriveExamType(category, title) {
  const s = `${category || ''} ${title || ''}`.toUpperCase()
  for (const t of ['RACGP', 'ACRRM', 'AMC', 'PESCI', 'NZREX', 'FRANZCOG', 'KFP', 'AKT', 'CCE']) {
    if (s.includes(t)) return t
  }
  return category ? category.split(';')[0].trim() : 'Unassigned'
}

export async function getFormTitle(formId) {
  const p = await jf(`/form/${formId}/properties`)
  return p?.title || ''
}

export async function getFormQuestions(formId) {
  const content = await jf(`/form/${formId}/questions`)
  return Object.values(content || {}).sort((a, b) => Number(a.order) - Number(b.order))
}

// NOTE: \s in JS already matches non-breaking space (U+00A0), CR, etc., so a
// single \s+ collapse fixes the "invisible nbsp breaks my regex" problem.
const stripHtml = (h) =>
  String(h || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&rsquo;|&lsquo;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/​|﻿/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const isQ = (t) => /^q\s*\d/i.test(t)

/**
 * Parse a PassGP clinical case form into:
 *  { formId, title, category, scenario, questions[], modelAnswers[], hints }
 * The "model answers" / hints are examiner-only marking material.
 */
export async function parseClinicalCase(formId, knownTitle) {
  const [title, questions] = await Promise.all([
    knownTitle != null ? Promise.resolve(knownTitle) : getFormTitle(formId),
    getFormQuestions(formId),
  ])

  const texts = questions
    .filter((q) => q.type === 'control_text')
    .map((q) => ({ order: Number(q.order), qid: q.qid, text: stripHtml(q.text) }))
    .filter((t) => t.text)

  const markerIdx = texts.findIndex((t) => /answers? for each question are below/i.test(t.text))
  const before = markerIdx >= 0 ? texts.slice(0, markerIdx) : texts
  const after = markerIdx >= 0 ? texts.slice(markerIdx + 1) : []

  const scenario =
    before.find((t) => !isQ(t.text) && !/^category:/i.test(t.text) && !/^hints and tips/i.test(t.text))?.text || ''
  const questionsList = before.filter((t) => isQ(t.text)).map((t) => t.text)
  const modelAnswers = after.filter((t) => isQ(t.text)).map((t) => t.text)
  const hints = texts.find((t) => /^hints and tips/i.test(t.text))?.text || ''
  const category = (texts.find((t) => /^category:/i.test(t.text))?.text || '').replace(/^category:\s*/i, '')

  return { formId, title, category, scenario, questions: questionsList, modelAnswers, hints }
}

/* --------------------------------- WRITE --------------------------------- */

/** Create a submission. fields = { qid: value }. Returns { submissionID }. */
export async function createSubmission(formId, fields = {}) {
  const params = new URLSearchParams()
  for (const [qid, val] of Object.entries(fields)) params.append(`submission[${qid}]`, val)
  return jf(`/form/${formId}/submissions`, { method: 'POST', body: params.toString() })
}

export async function deleteSubmission(submissionId) {
  return jf(`/submission/${submissionId}`, { method: 'DELETE' })
}

/** Create a minimal form (used to verify write access). Returns { id, ... }. */
export async function createForm({ title = 'PassGP Test', fieldLabel = 'Note' } = {}) {
  const params = new URLSearchParams()
  params.append('properties[title]', title)
  params.append('questions[0][type]', 'control_head')
  params.append('questions[0][text]', title)
  params.append('questions[0][order]', '1')
  params.append('questions[0][name]', 'header')
  params.append('questions[1][type]', 'control_textbox')
  params.append('questions[1][text]', fieldLabel)
  params.append('questions[1][order]', '2')
  params.append('questions[1][name]', 'note')
  return jf(`/user/forms`, { method: 'POST', body: params.toString() })
}

export async function deleteForm(formId) {
  return jf(`/form/${formId}`, { method: 'DELETE' })
}
