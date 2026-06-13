import { supabase } from './supabase.js'

/**
 * Fetch one active question for an exam type from the bank.
 * Returns null if Supabase isn't configured or the bank is empty
 * (callers then fall back to the hard-coded sample case).
 */
export async function getRandomQuestion(examType = 'RACGP') {
  if (!supabase) return null
  try {
    const { data, error } = await supabase
      .from('exam_questions')
      .select('*')
      .eq('is_active', true)
      .eq('exam_type', examType)
      .limit(50)
    if (error || !data || data.length === 0) {
      // fall back to any active question
      const any = await supabase.from('exam_questions').select('*').eq('is_active', true).limit(50)
      if (any.error || !any.data || any.data.length === 0) return null
      return any.data[Math.floor(Math.random() * any.data.length)]
    }
    return data[Math.floor(Math.random() * data.length)]
  } catch {
    return null
  }
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
        status: 'completed',
        ended_at: new Date().toISOString(),
        duration_sec: durationSec,
        questions_answered: questionsAnswered,
        word_count: wordCount,
        confidence: feedback.confidence ?? null,
        score: feedback.score ?? null,
        result: feedback.result ?? null,
        summary: feedback.summary ?? null,
        strengths: feedback.strengths ?? [],
        improvements: feedback.improvements ?? [],
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
