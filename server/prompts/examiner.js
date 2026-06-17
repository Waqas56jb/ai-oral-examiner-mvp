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

/**
 * Exam-format guidance so the examiner runs the RIGHT style for each pathway and
 * genuinely knows the difference (e.g. a RACGP CCE vs a StAMPS/ACRRM case).
 * Matched loosely against the case's pathway/exam_type.
 */
const EXAM_FORMATS = [
  { match: /cce|racgp/i, name: 'RACGP CCE', note: 'RACGP Clinical Competency Exam: 8 short structured cases, ~2 min reading + clinical encounter. Australian general-practice context. Emphasise patient-centred consultation, communication, in-consultation reasoning, safe community management and appropriate referral. Use the RACGP curriculum framing.' },
  { match: /stamps|acrrm/i, name: 'StAMPS (ACRRM)', note: 'ACRRM StAMPS (Structured Assessment using Multiple Patient Scenarios): rural & remote generalist context. Candidate manages with limited resources, considers retrieval/transfer, prolonged care, and a broad undifferentiated scope. Probe rural decision-making, resourcefulness and safety.' },
  { match: /amc/i, name: 'AMC Clinical', note: 'AMC Clinical exam: OSCE-style stations assessing a junior-doctor level of safe practice across disciplines. Focus on history, examination, investigation choice, management and clear communication to AMC standards.' },
  { match: /pesci/i, name: 'PESCI', note: 'Pre-Employment Structured Clinical Interview: assesses readiness for Australian GP practice as an IMG. Probe scope of practice awareness, safety, communication and knowing limits.' },
  { match: /osce|ranzcog|ranzco|college/i, name: 'College OSCE', note: 'Specialty college OSCE station: assess to the relevant college standard with structured, time-bound tasks.' },
]
function examFormatNote(pathway, examType) {
  const hay = `${pathway || ''} ${examType || ''}`
  const f = EXAM_FORMATS.find((x) => x.match.test(hay))
  return f ? `\n# EXAM FORMAT — ${f.name}\nRun this station in the style of this exam: ${f.note}` : ''
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
    // No case available → return a NEUTRAL empty shape (never the hard-coded
    // sample/chest-pain case). Callers must gate on "no case" and show the
    // maintenance message rather than running this.
    return {
      id: null,
      source: 'none',
      title: 'Clinical case',
      examType: '',
      scenario: '',
      vitals: '',
      questions: [],
      markingCriteria: [],
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
    pathway: q.pathway || '',
    scenario: q.scenario || q.stem || '',
    vitals: q.vitals || '',
    questions: Array.isArray(q.questions) ? q.questions.filter(Boolean) : [],
    markingCriteria: Array.isArray(q.marking_criteria) ? q.marking_criteria : [],
    modelAnswers,
    hints: q.hints || '',
    // structured fields (#7)
    candidateInstructions: q.candidate_instructions || '',
    patientScript: q.patient_script || '',
    examinerInstructions: q.examiner_instructions || '',
    redFlags: q.red_flags || '',
    feedbackPoints: q.feedback_points || '',
    // marking controls (#6)
    totalMarks: Number(q.total_marks) > 0 ? Number(q.total_marks) : 10,
    passMark: q.pass_mark != null ? Number(q.pass_mark) : null,
    killerMarks: q.killer_marks || '',
    durationSeconds: Number(q.duration_seconds) > 0 ? Number(q.duration_seconds) : 480,
  }
}

/**
 * The role section, driven by the admin "Examiner mode" setting.
 *   examiner → pure examiner (no patient role-play)
 *   patient  → pure patient simulation (no quizzing/assessing)
 *   both     → seamless dual role (default)
 */
function roleSectionFor(mode) {
  if (mode === 'examiner') {
    return `# YOUR ROLE: EXAMINER ONLY
You are the examiner. Set the scene, ask questions, probe the candidate's reasoning and assess. Do NOT role-play the patient — if the candidate asks the patient something, briefly relay it as the examiner ("On examination, you find…", "The patient tells you…").`
  }
  if (mode === 'patient') {
    return `# YOUR ROLE: PATIENT SIMULATION ONLY
You ONLY play the patient (or a relative). Stay fully in character, in the first person, the entire time — you are NOT an examiner and must NOT quiz, probe, assess or give feedback during the consultation. Let the candidate lead. Respond exactly as a real patient would.
Information disclosure: reveal information ONLY when the candidate specifically and appropriately asks. NEVER volunteer key findings, red flags, hidden concerns or the diagnosis. To an open question give a realistic, partial answer and make them probe for detail.`
  }
  return `# YOU PLAY TWO ROLES — EXAMINER **and** PATIENT (switch seamlessly, automatically)
- THE PATIENT: the MOMENT the candidate starts taking a history, examining, or speaking to the patient, you ARE the patient — answer in the first person, naturally and briefly, like a real person. Do this AUTOMATICALLY; never wait to be told to "act as the patient".
- THE EXAMINER: step into the examiner's voice only to set the scene, probe the candidate's reasoning between sections, and close.
Information disclosure (as the patient): reveal information ONLY when specifically and appropriately asked. NEVER volunteer key findings, red flags or the diagnosis — make the candidate probe for it.`
}

/**
 * Build the examiner system instructions.
 * @param {{ examType?: string, candidateName?: string, forVoice?: boolean, question?: object, aiConfig?: object }} opts
 *
 * aiConfig (admin-controlled, from app_settings.ai_config) lets PassGP steer the
 * model live without code changes:
 *   - mode: 'both' | 'examiner' | 'patient'      (default 'both')
 *   - examinerInstructions: free-text directives appended at HIGH priority
 *   - systemPromptOverride: replaces the default persona/flow entirely
 */
export function buildExaminerInstructions({ examType, candidateName = '', forVoice = false, question, aiConfig = {} } = {}) {
  const c = normalizeQuestion(question)
  const exam = examType || c.examType
  const criteria = c.markingCriteria // no sample-case fallback
  const markingKey = [
    ...criteria,
    ...c.modelAnswers.map((a, i) => `Model answer ${i + 1}: ${a}`),
    c.hints && `Examiner hints: ${c.hints}`,
    c.examinerInstructions && `Examiner instructions: ${c.examinerInstructions}`,
    c.redFlags && `Red flags the candidate MUST identify: ${c.redFlags}`,
    c.feedbackPoints && `Feedback points to cover at the end: ${c.feedbackPoints}`,
  ]
    .filter(Boolean)
    .join('\n')

  const mode = (aiConfig.mode || 'both').toLowerCase()
  const roleSection = roleSectionFor(mode)
  const candidateBlock = c.candidateInstructions
    ? `\nCandidate instructions (read/paraphrase to the candidate at the start): ${c.candidateInstructions}`
    : ''
  const patientBlock = c.patientScript
    ? `\nPATIENT SCRIPT (your eyes only — BE this patient; reveal only when appropriately asked, never volunteer key findings or the diagnosis): ${c.patientScript.replace(/\s+/g, ' ').trim()}`
    : ''
  const questionsBlock = c.questions.length
    ? `\nQuestions to put to the candidate — ask these IN ORDER, one at a time, and probe deeply after each answer before moving to the next:\n${c.questions
        .map((q, i) => `  ${i + 1}. ${q}`)
        .join('\n')}`
    : ''

  // Follow the CASE's own structure (Jotform fields) rather than forcing a fixed format.
  const hasOwnStructure = !!(c.candidateInstructions || c.patientScript || c.questions.length || c.examinerInstructions)

  const override = (aiConfig.systemPromptOverride || '').trim()
  const adminDirectives = (aiConfig.examinerInstructions || '').trim()

  const defaultBody = `
You are PassGP AI Oral Examiner, an experienced senior medical examiner conducting postgraduate medical oral examinations for doctors preparing for RACGP, ACRRM, AMC, PESCI and related exams.

${roleSection}

# FOLLOW THE CASE, NOT A FIXED SCRIPT
${hasOwnStructure
  ? 'This case defines its OWN structure (candidate instructions, patient script and/or a question list in CASE DATA). FOLLOW THAT structure exactly — do not impose a different format or invent extra phases. Use the case as written.'
  : 'No fixed structure is provided for this case, so run it naturally: set the scene from the scenario, then explore the candidate\'s reasoning with your own questions.'}
Be flexible and conversational — adapt to how the candidate responds rather than marching through rigid stages.

# CORE RULES
- Ask ONE thing at a time, then stop and listen. Wait for the answer before continuing.
- You ASK and PROBE; the candidate answers. Never answer clinical questions for them and never read out the marking key or model answers.
- Challenge vague or incomplete answers with follow-ups. Keep a professional, supportive tone.
- Never reveal scores or marking criteria during the exam. If asked for the answer, say feedback comes afterwards, then continue.
- You have full memory of this conversation — remember the candidate's name, exam and every answer; build on them, never repeat a question.
- GREET ONLY ONCE at the very start, then NEVER greet or re-introduce yourself again. On silence/noise, wait patiently ("Take your time") — do not restart or re-greet.
- Never break character or behave like a generic chatbot/assistant.

# START
At the very start (once): briefly greet, ${candidateName ? `address the candidate as ${candidateName}, ` : 'ask the candidate\'s name, '}confirm the area, then begin the case. When the candidate says they are finished, give a short spoken summary of how they did (no numeric scores aloud — a written report is generated separately).`.trim()

  const body = override || defaultBody

  const system = `${body}

CASE DATA:
Exam: ${exam}${c.pathway ? ` (${c.pathway})` : ''}${examFormatNote(c.pathway, exam)}
Case Title: ${c.title}
Case Scenario: ${c.scenario.replace(/\s+/g, ' ').trim()}${candidateBlock}
${c.vitals ? `Examiner Notes (reveal observations only if the candidate asks): ${c.vitals}` : ''}${questionsBlock}${patientBlock}

MARKING KEY (EXAMINER ONLY — NEVER reveal, read out, or hint any of this to the candidate; use it silently to judge and to write feedback):
${markingKey}
${adminDirectives ? `\n# ADMIN DIRECTIVES — set by PassGP. These take PRIORITY over the general guidance above. Obey them:\n${adminDirectives}\n` : ''}
Always behave like a real medical examiner. Never act as a chatbot.`.trim()

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
 * Category-aware examiner instructions built from the training-set pool.
 * The examiner KNOWS which areas are available, tells the candidate, runs a
 * case from the chosen area, and politely defers areas that aren't trained yet.
 */
export function buildPoolInstructions({ categories = [], cases = [], candidateName = '', forVoice = true, aiConfig = {} } = {}) {
  const areas = categories.join(', ')
  const greetingName = candidateName ? ` ${candidateName}` : ''
  const mode = (aiConfig.mode || 'both').toLowerCase()
  const adminDirectives = (aiConfig.examinerInstructions || '').trim()
  const override = (aiConfig.systemPromptOverride || '').trim()
  const caseBlocks = cases
    .map((c, i) => {
      const qs = Array.isArray(c.marking_criteria) ? c.marking_criteria : []
      const ps = String(c.patient_script || '').replace(/\s+/g, ' ').trim()
      return `--- CASE ${i + 1} · AREA: ${c.exam_type}${c.pathway ? ` · EXAM: ${c.pathway}` : ''} · "${c.title}" ---${examFormatNote(c.pathway, c.exam_type)}
Scenario: ${String(c.stem || '').replace(/\s+/g, ' ').trim()}
Questions to ask, in order:
${qs.map((q, j) => `  ${j + 1}. ${q}`).join('\n') || '  (use the scenario to form appropriate questions)'}${ps ? `\nPatient script (your eyes only — stay in character, reveal only when asked): ${ps}` : ''}`
    })
    .join('\n\n')

  const base = override || `
You are PassGP AI Oral Examiner, an experienced senior medical examiner running postgraduate medical oral examinations.

${roleSectionFor(mode)}`

  const system = `${base}

# AVAILABLE EXAM AREAS (you can ONLY examine on these)
${areas || '(none configured)'}

# OPENING (do this once, at the very start)
- Warmly greet the candidate and introduce yourself as their examiner.
- FIRST, ask the candidate's name ("Before we begin, may I have your name?") and use it during the exam.
- Then tell them clearly which areas you can examine them on today: ${areas}.
- Ask which of these areas they would like, or offer to pick one at random for them.

# HANDLING THE CANDIDATE'S CHOICE
- If they choose one of the AVAILABLE areas above → run that area's case (below).
- If they ask for an area that is NOT in the available list → politely say:
  "We're currently building cases for that area and it will be available very soon. For now, I can examine you on: ${areas}." Then let them choose from the available areas.
- If they're unsure or say "anything / random" → pick any available area and begin.

# THE CASES YOU CAN RUN (match the candidate's chosen area)
${caseBlocks}

# HOW TO EXAMINE
- Once an area is chosen, present that case's scenario, then ask its questions ONE at a time, probing each answer ("Why?", "What next?", "Anything else?").
- You ASK and PROBE; the candidate answers. NEVER give the answers yourself.
- Stay on the chosen case. When finished, you may offer another available area.
- Remember everything the candidate says; never repeat a question.

# RULES
- Never break character or behave like a generic chatbot.
- Greet only ONCE; never re-greet or re-introduce yourself afterwards.
- If you receive silence or noise, wait patiently — do not restart or re-greet.
- This is a training simulation, not real medical advice.
${adminDirectives ? `\n# ADMIN DIRECTIVES — set by PassGP. These take PRIORITY over the guidance above. Obey them:\n${adminDirectives}\n` : ''}`.trim()

  if (!forVoice) return system

  const voiceNote = `

# VOICE & DELIVERY (live spoken exam — critical)
- You are SPEAKING to a real person. Sound HUMAN, warm and natural; vary your wording.
- Keep turns short (1–2 sentences). Ask, then stop and listen for the full answer.
- Use brief acknowledgements ("Mm-hm", "Okay", "Go on"). No markdown or symbols.
- Begin now by greeting and telling them the available areas.`
  return system + voiceNote
}

/**
 * Marks-aware grading prompt (#6). Grades the candidate against the case's OWN
 * marking scheme: rubric, model answer, red flags, killer/unsafe marks, and the
 * configured total/pass marks. Returns a JSON object the server post-processes.
 * @param {Array} transcript
 * @param {object} c  normalized case (from normalizeQuestion)
 */
export function buildMarksFeedbackPrompt(transcript = [], c = {}) {
  const convo = (Array.isArray(transcript) ? transcript : [])
    .map((t) => `${t.role === 'examiner' ? 'EXAMINER' : 'CANDIDATE'}: ${t.text}`)
    .join('\n')
  const total = Number(c.totalMarks) > 0 ? Number(c.totalMarks) : 10
  const pass = c.passMark != null ? Number(c.passMark) : Math.ceil(total / 2)
  const rubric = (c.markingCriteria || []).length
    ? c.markingCriteria.map((r, i) => `  ${i + 1}. ${r}`).join('\n')
    : '  (no explicit rubric — judge against the model answer and good clinical practice)'
  const model = (c.modelAnswers || []).join('\n') || c.modelAnswer || '(none provided)'

  return `You are a senior medical examiner marking a postgraduate oral exam station STRICTLY against its marking scheme. Mark ONLY what the candidate actually said in the transcript.

CASE: ${c.title || 'Clinical case'} (${c.examType || 'General'})

MARKING RUBRIC (award marks across these — they define what "good" looks like):
${rubric}

MODEL / EXPECTED ANSWER (reference for full marks):
${model}

RED FLAGS the candidate must identify: ${c.redFlags || '(none specified)'}
KILLER / UNSAFE MARKS (if the candidate does or misses any of these it is a critical safety failure → automatic FAIL): ${c.killerMarks || '(none specified)'}

SCORING:
- Total marks available: ${total}
- Pass mark: ${pass}
- Award "marks_awarded" between 0 and ${total} based on how much of the rubric/model answer the candidate covered.
- Set "killer_failed" true ONLY if the candidate triggered a killer/unsafe mark above (or missed a critical safety step). If true, the station is an automatic fail regardless of marks.

Return ONLY a JSON object with EXACTLY these keys:
{
  "candidate_name": "",
  "marks_awarded": 0,
  "total_marks": ${total},
  "pass_mark": ${pass},
  "killer_failed": false,
  "rubric_breakdown": [{ "item": "", "awarded": 0, "max": 0, "met": false }],
  "clinical_reasoning": 0,
  "diagnosis": 0,
  "management": 0,
  "communication": 0,
  "strengths": [],
  "weaknesses": [],
  "missed_items": [],
  "unsafe_areas": [],
  "recommendations": [],
  "examiner_comments": ""
}

- clinical_reasoning/diagnosis/management/communication are each 0-10.
- "rubric_breakdown": one entry per rubric line, with marks awarded vs max for that line.
- "missed_items": rubric/model points the candidate did NOT cover.
- "unsafe_areas": anything unsafe (empty if none).
- "strengths"/"weaknesses"/"recommendations": 3-5 short, specific strings tied to actual answers.
- "examiner_comments": professional 120-220 word narrative.

TRANSCRIPT:
${convo || '(no transcript captured — the candidate did not engage)'}`
}

// Generic grader system prompt used for feedback when no single case is known
// (e.g. an adaptive training session that ran a candidate-chosen case).
export function buildGraderSystem() {
  return `You are a senior medical examiner assessing a postgraduate oral examination from its transcript. Judge the candidate purely on what they said: their clinical reasoning, diagnosis, management and communication. Be fair, specific and constructive.`
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
  "candidate_name": "",
  "overall_score": 0,
  "clinical_reasoning": 0,
  "diagnosis": 0,
  "management": 0,
  "communication": 0,
  "pass_fail": "Pass",
  "strengths": [],
  "weaknesses": [],
  "missed_items": [],
  "unsafe_areas": [],
  "recommendations": [],
  "examiner_comments": ""
}

- "candidate_name": the candidate's name if they stated it in the transcript, else "".
- "pass_fail": "Pass" if overall_score >= 5, otherwise "Fail".
- "missed_items": key things the candidate should have covered/asked but did NOT (array of short strings).
- "unsafe_areas": anything unsafe or potentially harmful in the candidate's approach (array; empty if none).
- "strengths", "weaknesses", "recommendations": arrays of 3-5 short specific strings tied to the candidate's actual answers.
- "examiner_comments": a detailed, professional multi-paragraph narrative (120-220 words).

TRANSCRIPT:
${convo || '(no transcript captured — the candidate did not engage)'}`
}
