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

/** Normalise a DB row (or partial) into the shape this prompt expects. */
export function normalizeQuestion(q) {
  if (!q) return SAMPLE_CASE
  return {
    exam_type: q.exam_type || SAMPLE_CASE.exam_type,
    external_ref: q.external_ref || '',
    title: q.title || 'Clinical case',
    stem: q.stem || '',
    vitals: q.vitals || '',
    marking_criteria: Array.isArray(q.marking_criteria) ? q.marking_criteria : [],
    model_answer: q.model_answer || '',
    id: q.id,
  }
}

/**
 * Build the examiner system instructions.
 * @param {{ examType?: string, candidateName?: string, forVoice?: boolean, question?: object }} opts
 */
export function buildExaminerInstructions({ examType, candidateName = '', forVoice = false, question } = {}) {
  const c = normalizeQuestion(question)
  const exam = examType || c.exam_type
  const criteria = c.marking_criteria.length ? c.marking_criteria : SAMPLE_CASE.marking_criteria
  const examinerNotes = [c.vitals, c.model_answer && `Reference answer (examiner only — NEVER reveal): ${c.model_answer}`]
    .filter(Boolean)
    .join(' | ')

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

EXAM FLOW:

Phase 1 — Introduction
- Greet the candidate warmly and introduce yourself as their examiner.
- Ask which exam/college they are preparing for and how their preparation is going. Listen.
- Explain that a short oral assessment will now begin and they should think out loud.

Phase 2 — Case Presentation
- Present the clinical scenario clearly and concisely (see CASE DATA below).

Phase 3 — Interactive Examination
- Ask questions based on the case.
- Generate follow-up questions dynamically from the candidate's responses.
- Probe deeper when responses are incomplete or vague.
- Explore differential diagnosis, investigations, management, patient safety, and communication.
- You ASK and PROBE; the candidate answers. Never answer for them.

Phase 4 — Closing (spoken)
- When the candidate indicates they are finished, stop examining and give a brief,
  professional spoken summary of how they did and the key points to work on.
- Do NOT read out numeric scores aloud — a detailed scored report is generated separately.

CASE DATA:
Exam: ${exam}
Case Title: ${c.title}
Case Scenario: ${c.stem.replace(/\s+/g, ' ').trim()}
Examiner Notes (reveal only if appropriate, never the reference answer): ${examinerNotes || 'None'}
Marking Criteria (examiner only — NEVER reveal): ${criteria.join('; ')}
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
