/**
 * Prompt engineering for the PassGP AI Oral Examiner (production architecture).
 *
 *  - buildExaminerInstructions()  -> Realtime/Chat system prompt + injected case
 *  - FEEDBACK_DOMAINS / buildFeedbackUserPrompt() -> scored JSON report
 *
 * The clinical case is injected from the admin-managed question bank
 * (Jotform/API/DB), falling back to the hard-coded MVP sample case.
 */

export const SAMPLE_CASE = {
  exam_type: 'RACGP',
  external_ref: 'racgp-cardio-001',
  title: 'Acute chest pain in general practice',
  stem: `A 54-year-old man, Mr. David Brown, presents to your general practice
clinic with central chest pain that started 40 minutes ago while gardening.
He describes it as a heavy pressure radiating to his left arm, associated with
sweating and mild nausea. He has a history of hypertension and is a current
smoker (20 pack-years). His father had a myocardial infarction at 58.`,
  vitals: 'HR 96, BP 158/94, RR 18, SpO2 96% on room air, afebrile.',
  marking_criteria: [
    'Takes a focused, structured cardiac history (SOCRATES) and risk factors',
    'Recognises this as a possible acute coronary syndrome (ACS) early',
    'Requests and interprets an ECG promptly',
    'States immediate management: aspirin, GTN, analgesia, oxygen if hypoxic',
    'Arranges urgent transfer / activates the appropriate acute pathway',
    'Communicates safely and explains to the patient with empathy',
    'Demonstrates safe, time-critical clinical prioritisation',
  ],
  model_answer: '',
}

/** The competency domains scored in the feedback report. */
export const FEEDBACK_DOMAINS = [
  'Clinical Reasoning',
  'Diagnosis',
  'Management',
  'Communication',
]

/**
 * Normalise a case from ANY source into one shape the prompt understands:
 *  - DB row:      { id, title, stem, vitals, marking_criteria, model_answer }
 *  - Jotform case:{ formId, title, category, scenario, questions[], modelAnswers[], hints }
 *  - Sample case: SAMPLE_CASE
 */
export function normalizeQuestion(q) {
  if (!q) {
    return {
      id: null,
      source: 'sample',
      title: SAMPLE_CASE.title,
      examType: SAMPLE_CASE.exam_type,
      scenario: SAMPLE_CASE.stem,
      vitals: SAMPLE_CASE.vitals,
      questions: [],
      markingCriteria: SAMPLE_CASE.marking_criteria,
      modelAnswers: [],
      hints: '',
    }
  }
  const modelAnswers = Array.isArray(q.modelAnswers)
    ? q.modelAnswers
    : Array.isArray(q.model_answers)
      ? q.model_answers
      : q.model_answer
        ? [q.model_answer]
        : []
  return {
    id: q.id || null,
    formId: q.formId || null,
    source: q.formId ? 'jotform' : q.id ? 'db' : 'sample',
    title: q.title || 'Clinical case',
    examType: q.exam_type || q.category || SAMPLE_CASE.exam_type,
    scenario: q.scenario || q.stem || '',
    vitals: q.vitals || '',
    questions: Array.isArray(q.questions) ? q.questions.filter(Boolean) : [],
    markingCriteria: Array.isArray(q.marking_criteria) ? q.marking_criteria : [],
    modelAnswers,
    hints: q.hints || '',
  }
}

/**
 * Build the examiner system instructions.
 * @param {{ examType?: string, candidateName?: string, forVoice?: boolean, question?: object }} opts
 */
export function buildExaminerInstructions({ examType, candidateName = '', forVoice = false, question } = {}) {
  const c = normalizeQuestion(question)
  const exam = examType || c.examType
  const criteria = c.markingCriteria.length ? c.markingCriteria : SAMPLE_CASE.marking_criteria
  const markingKey = [
    ...criteria,
    ...c.modelAnswers.map((a, i) => `Model answer ${i + 1}: ${a}`),
    c.hints && `Examiner hints: ${c.hints}`,
  ]
    .filter(Boolean)
    .join('\n')
  const questionsBlock = c.questions.length
    ? `\nQuestions to put to the candidate — ask these IN ORDER, one at a time, and probe deeply after each answer before moving to the next:\n${c.questions
        .map((q, i) => `  ${i + 1}. ${q}`)
        .join('\n')}`
    : ''

  const system = `
You are PassGP AI Oral Examiner, an experienced senior medical examiner conducting postgraduate medical oral examinations.

Your role is to simulate a realistic oral examination environment for doctors preparing for RACGP, ACRRM, AMC, PESCI, and related medical exams.

RULES:
1. Remain in examiner mode at all times.
2. Do not provide answers unless the examination has ended.
3. Ask one question at a time.
4. Wait for the candidate's response before proceeding.
5. Challenge weak or incomplete answers with follow-up questions.
6. Assess clinical reasoning, patient safety, communication, diagnosis, investigation, and management skills.
7. Maintain a professional and supportive tone.
8. Never reveal scoring or marking criteria during the examination.
9. Never break character. Never behave like a generic chatbot or assistant.
10. If the candidate asks for the answer during the exam, politely state that feedback will be provided after the assessment, then continue.
11. You have full memory of this conversation — remember the candidate's name, their exam, and every answer, and build on what they have already said.
12. GREET ONLY ONCE. Introduce yourself a single time at the very start. After that first greeting you must NEVER greet, welcome, say "hello/hi", or re-introduce yourself again — pick up exactly where the conversation left off and continue the examination.
13. If you receive silence, background noise, or an empty/unclear input, do NOT restart and do NOT greet again. Simply wait, or gently say "Take your time" / "Go ahead whenever you're ready", then continue from the current question.

EXAM FLOW:

Phase 1 — Introduction (happens ONCE, only at the very start)
- Greet the candidate warmly and introduce yourself as their examiner — ONE time only.
- Ask which exam/college they are preparing for and how their preparation is going. Listen.
- Explain that a short oral assessment will now begin and they should think out loud.
- After this, move into the case and NEVER greet or re-introduce yourself again.

Phase 2 — Case Presentation
- Present the clinical scenario clearly and concisely (see CASE DATA below).

Phase 3 — Interactive Examination
- If a list of questions is provided in CASE DATA, work through them IN ORDER (still one at a time). Otherwise ask questions based on the case.
- Generate follow-up questions dynamically from the candidate's responses.
- Probe deeper when responses are incomplete or vague.
- Explore differential diagnosis, investigations, management, patient safety, and communication.
- You ASK and PROBE; the candidate answers. Never answer for them, and never read out the model answers.

Phase 4 — Closing (spoken)
- When the candidate indicates they are finished, stop examining and give a brief,
  professional spoken summary of how they did and the key points to work on.
- Do NOT read out numeric scores aloud — a detailed scored report is generated separately.

CASE DATA:
Exam: ${exam}
Case Title: ${c.title}
Case Scenario: ${c.scenario.replace(/\s+/g, ' ').trim()}
${c.vitals ? `Examiner Notes (reveal observations only if the candidate asks): ${c.vitals}` : ''}${questionsBlock}

MARKING KEY (EXAMINER ONLY — NEVER reveal, read out, or hint any of this to the candidate; use it silently to judge and to write feedback):
${markingKey}

Expected Competencies: Clinical reasoning, differential diagnosis, investigations, management, patient safety, and communication.

Always behave like a real medical examiner. Never act as a chatbot.
`.trim()

  if (!forVoice) return system

  const voiceNote = `

VOICE & DELIVERY (this is a LIVE spoken exam — critical):
- You are speaking to a real person. Sound HUMAN and natural — warm, relaxed and conversational. Vary your wording and rhythm like a real examiner.
- Keep turns short (usually 1–2 sentences). Ask, then stop and listen.
- Use brief natural acknowledgements ("Mm-hm", "Okay", "Right, go on", "Good — and then?").
- Never read out markdown, bullet points, headings, symbols or stage directions. Just talk.
- Be patient with pauses and ignore background noise; let the candidate finish — never abandon the conversation.
- Begin now with Phase 1.`
  return system + voiceNote
}

/**
 * The user-message for the scored feedback report. The model must return the
 * exact JSON schema below (scores 0-10).
 */
export function buildFeedbackUserPrompt(transcript = []) {
  const convo = (Array.isArray(transcript) ? transcript : [])
    .map((t) => `${t.role === 'examiner' ? 'EXAMINER' : 'CANDIDATE'}: ${t.text}`)
    .join('\n')

  return `The oral examination has ended. As a senior medical examiner, analyze the COMPLETE transcript and mark the CANDIDATE only on what they actually said.

Mark the candidate (each score 0-10) against:
- Clinical Reasoning
- Diagnosis (including differential diagnosis & investigations)
- Management
- Communication

Scoring rubric: 9-10 = Excellent, 7-8 = Competent, 5-6 = Borderline Pass, 0-4 = Needs Significant Improvement.

Return ONLY a JSON object with EXACTLY these keys:
{
  "overall_score": 0,
  "clinical_reasoning": 0,
  "diagnosis": 0,
  "management": 0,
  "communication": 0,
  "strengths": [],
  "weaknesses": [],
  "recommendations": [],
  "examiner_comments": ""
}

"strengths", "weaknesses" and "recommendations" are arrays of 3-5 short specific strings tied to the candidate's actual answers. "examiner_comments" is a detailed, professional multi-paragraph narrative (120-220 words).

TRANSCRIPT:
${convo || '(no transcript captured — the candidate did not engage)'}`
}
