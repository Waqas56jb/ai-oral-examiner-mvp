import { supabase } from './supabase.js'

/**
 * Fetch one active question for an exam type from the bank.
 * Returns null if Supabase isn't configured or the bank is empty
 * (callers then fall back to the hard-coded sample case).
 */
// ONLY returns questions the admin has pushed into the training set.
// No hard-coded / sample / untrained fallback — null means "nothing trained yet".
export async function getRandomQuestion(examType) {
  if (!supabase) return null
  const pick = (rows) => (rows && rows.length ? rows[Math.floor(Math.random() * rows.length)] : null)
  try {
    // 1) If a SPECIFIC exam type/category is requested, prefer it (within training set)
    if (examType) {
      const r = await supabase
        .from('exam_questions')
        .select('*')
        .eq('is_active', true)
        .eq('in_training', true)
        .eq('exam_type', examType)
        .limit(500)
      if (!r.error && r.data?.length) return pick(r.data)
    }
    // 2) Otherwise: ANY case in the training set (its own category is used, NOT RACGP)
    const r = await supabase.from('exam_questions').select('*').eq('is_active', true).eq('in_training', true).limit(1000)
    if (!r.error && r.data?.length) return pick(r.data)
    return null
  } catch {
    return null
  }
}

/**
 * Build a category-aware pool from the training set:
 *   { categories: [names...], cases: [one case per category] }
 * The examiner uses this to tell the candidate which areas it can test, and to
 * run a case from the area the candidate chooses.
 */
export async function getTrainingPool(maxCategories = 16, focusCategory = '') {
  if (!supabase) return { categories: [], cases: [] }
  try {
    let q = supabase
      .from('exam_questions')
      .select('id, title, exam_type, stem, marking_criteria, patient_script')
      .eq('is_active', true)
      .eq('in_training', true)
      .limit(3000)
    // Admin "focus on one exam" lock: restrict the pool to a single area.
    if (focusCategory) q = q.eq('exam_type', focusCategory)
    let { data } = await q
    // If the focus area has no trained cases, fall back to the whole set.
    if (focusCategory && !data?.length) {
      const all = await supabase
        .from('exam_questions')
        .select('id, title, exam_type, stem, marking_criteria, patient_script')
        .eq('is_active', true).eq('in_training', true).limit(3000)
      data = all.data
    }
    if (!data?.length) return { categories: [], cases: [] }

    const byCat = new Map()
    for (const q of data) {
      const cat = (q.exam_type || 'General').trim()
      if (!byCat.has(cat)) byCat.set(cat, [])
      byCat.get(cat).push(q)
    }
    const categories = [...byCat.keys()].sort()
    // One random case per category, capped (keeps the prompt a sensible size)
    const chosen = categories.slice(0, maxCategories)
    const cases = chosen.map((cat) => {
      const arr = byCat.get(cat)
      return arr[Math.floor(Math.random() * arr.length)]
    })
    return { categories: chosen, cases, allCount: data.length }
  } catch {
    return { categories: [], cases: [] }
  }
}

/**
 * Build a mock-exam circuit: N distinct random cases from the training set.
 * Optionally filtered by pathway/category. Returns a list of station descriptors.
 */
export async function getCircuit({ count = 3, pathway = '', examType = '' } = {}) {
  if (!supabase) return []
  try {
    let query = supabase
      .from('exam_questions')
      .select('id, title, exam_type, pathway, duration_seconds')
      .eq('is_active', true)
      .eq('in_training', true)
      .limit(3000)
    if (pathway) query = query.eq('pathway', pathway)
    if (examType) query = query.eq('exam_type', examType)
    const { data } = await query
    let pool = data || []
    // If a filter yields nothing, fall back to the whole training set.
    if (!pool.length && (pathway || examType)) {
      const { data: all } = await supabase
        .from('exam_questions').select('id, title, exam_type, pathway, duration_seconds')
        .eq('is_active', true).eq('in_training', true).limit(3000)
      pool = all || []
    }
    if (!pool.length) return []
    // Shuffle and take up to `count` distinct cases.
    const shuffled = pool.slice().sort(() => Math.random() - 0.5)
    const n = Math.max(1, Math.min(Number(count) || 3, 10, shuffled.length))
    return shuffled.slice(0, n).map((q, i) => ({
      station: i + 1,
      questionId: q.id,
      title: q.title || `Station ${i + 1}`,
      examType: q.exam_type || 'General',
      pathway: q.pathway || '',
      durationSeconds: Number(q.duration_seconds) > 0 ? Number(q.duration_seconds) : 480,
    }))
  } catch {
    return []
  }
}

// Count of cases currently in the training set.
export async function trainingCount() {
  if (!supabase) return 0
  const { count } = await supabase
    .from('exam_questions')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .eq('in_training', true)
  return count || 0
}

export async function getQuestionById(id) {
  if (!supabase || !id) return null
  try {
    const { data, error } = await supabase.from('exam_questions').select('*').eq('id', id).single()
    if (error) return null
    return data
  } catch {
    return null
  }
}

/**
 * Persist a completed session + its transcript + feedback.
 * Best-effort: returns { id } on success, or null on failure (never throws).
 */
export async function saveSession(session) {
  if (!supabase) return null
  try {
    const {
      userId = null,
      questionId = null,
      examType = 'RACGP',
      candidateName = null,
      candidateEmail = null,
      pathway = null,
      durationSec = 0,
      questionsAnswered = 0,
      wordCount = 0,
      feedback = {},
      transcript = [],
    } = session

    const { data, error } = await supabase
      .from('exam_sessions')
      .insert({
        user_id: userId,
        question_id: questionId,
        exam_type: examType,
        candidate_name: candidateName,
        candidate_email: candidateEmail,
        pathway: pathway,
        status: 'completed',
        ended_at: new Date().toISOString(),
        duration_sec: durationSec,
        questions_answered: questionsAnswered,
        word_count: wordCount,
        confidence: feedback.confidence ?? null,
        score: feedback.score ?? null,
        result: feedback.result ?? null,
        pass_fail: feedback.pass_fail ?? null,
        summary: feedback.summary ?? null,
        strengths: feedback.strengths ?? [],
        improvements: feedback.improvements ?? [],
        missed_items: feedback.missed_items ?? [],
        unsafe_areas: feedback.unsafe_areas ?? [],
      })
      .select('id')
      .single()

    if (error || !data) return null

    if (Array.isArray(transcript) && transcript.length) {
      const rows = transcript
        .filter((t) => t && (t.role === 'examiner' || t.role === 'candidate') && t.text)
        .map((t) => ({
          session_id: data.id,
          role: t.role,
          text: t.text,
          time_marker: t.time || null,
        }))
      if (rows.length) await supabase.from('session_turns').insert(rows)
    }

    return { id: data.id }
  } catch {
    return null
  }
}
