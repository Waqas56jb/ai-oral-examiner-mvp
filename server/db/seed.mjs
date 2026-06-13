import 'dotenv/config'
import { supabase } from './supabase.js'

/**
 * Seed the question bank with 2 sample questions per exam pathway.
 * Idempotent: skips any question whose external_ref already exists.
 *   Run:  npm run seed
 */

const QUESTIONS = [
  // ---------------- RACGP ----------------
  {
    exam_type: 'RACGP',
    external_ref: 'racgp-resp-001',
    title: 'Chronic productive cough in a smoker',
    stem: 'A 58-year-old man presents with a 3-month history of a productive cough and increasing breathlessness on exertion. He has a 30 pack-year smoking history and has not seen a doctor in years.',
    vitals: 'HR 88, BP 138/84, RR 20, SpO2 93% on room air, afebrile.',
    marking_criteria: [
      'Takes a focused respiratory history including red flags (haemoptysis, weight loss)',
      'Considers COPD, lung malignancy and infection in the differential',
      'Requests spirometry and chest X-ray appropriately',
      'Addresses smoking cessation with a clear, supportive plan',
      'Explains the diagnosis and safety-nets effectively',
    ],
    model_answer:
      'A structured answer takes a focused history (cough character, sputum, haemoptysis, weight loss, occupational exposure), examines the respiratory system, and screens red flags for malignancy. Investigations include spirometry (to confirm airflow obstruction) and a chest X-ray. Management centres on smoking cessation support, inhaled therapy if COPD is confirmed, and clear safety-netting with referral if red flags are present.',
  },
  {
    exam_type: 'RACGP',
    external_ref: 'racgp-derm-001',
    title: 'Changing pigmented skin lesion',
    stem: 'A 45-year-old woman is concerned about a mole on her back that her partner says has grown and darkened over the past few months. She has fair skin and a history of sunburn as a child.',
    vitals: 'Not applicable — focused skin assessment.',
    marking_criteria: [
      'Applies the ABCDE criteria to assess the lesion',
      'Elicits risk factors for melanoma (fair skin, sun exposure, family history)',
      'Recognises the need for urgent dermoscopy / excision biopsy',
      'Avoids falsely reassuring the patient',
      'Communicates the plan and follow-up clearly',
    ],
    model_answer:
      'Assess the lesion using ABCDE (Asymmetry, Border, Colour, Diameter, Evolution) and dermoscopy. A changing, darkening lesion in a high-risk patient warrants urgent excision biopsy rather than watchful waiting. Counsel on sun protection and full skin examination, and arrange timely follow-up of histology.',
  },

  // ---------------- ACRRM ----------------
  {
    exam_type: 'ACRRM',
    external_ref: 'acrrm-trauma-001',
    title: 'Rural trauma — motorbike accident',
    stem: 'You are the sole doctor at a remote clinic. A 24-year-old man is brought in after coming off his motorbike at speed. He is confused, with an obvious deformed right thigh and is pale and sweaty.',
    vitals: 'HR 124, BP 92/60, RR 26, SpO2 95%, GCS 13.',
    marking_criteria: [
      'Applies a structured primary survey (ABCDE)',
      'Recognises haemorrhagic shock and initiates resuscitation',
      'Manages the femoral fracture and controls bleeding',
      'Arranges early retrieval / transfer given remote setting',
      'Communicates clearly with the retrieval team (ISBAR)',
    ],
    model_answer:
      'Use a primary survey: secure airway with C-spine control, assess breathing, then circulation — this patient is in haemorrhagic shock from a femoral fracture. Apply direct pressure/splinting, gain IV access, give balanced fluids/blood, and provide analgesia. As the sole rural doctor, activate retrieval early and hand over using ISBAR.',
  },
  {
    exam_type: 'ACRRM',
    external_ref: 'acrrm-paeds-001',
    title: 'Febrile child in a remote community',
    stem: 'A 2-year-old is brought to your remote clinic with fever and lethargy for one day. The parents are worried because the child is now difficult to rouse.',
    vitals: 'Temp 39.4, HR 170, RR 40, CRT 3s, looks unwell.',
    marking_criteria: [
      'Performs a rapid paediatric assessment and identifies a sick child',
      'Considers sepsis and meningitis early',
      'Initiates empirical antibiotics without delay',
      'Recognises limits of the remote setting and arranges retrieval',
      'Supports and communicates clearly with anxious parents',
    ],
    model_answer:
      'This is a potentially septic, seriously unwell child. Assess using the paediatric triangle, obtain IV/IO access, take cultures if feasible but do not delay empirical IV antibiotics for suspected sepsis/meningitis. Give fluids, manage fever, and arrange urgent retrieval, keeping the family informed throughout.',
  },

  // ---------------- AMC ----------------
  {
    exam_type: 'AMC',
    external_ref: 'amc-obs-001',
    title: 'Primary postpartum haemorrhage',
    stem: 'A 30-year-old woman has just delivered vaginally. Within 10 minutes there is heavy, ongoing vaginal bleeding and she is becoming distressed.',
    vitals: 'HR 118, BP 98/58, RR 22, estimated blood loss 900 mL and rising.',
    marking_criteria: [
      'Recognises primary PPH and calls for help immediately',
      'Works through the 4 Ts (Tone, Trauma, Tissue, Thrombin)',
      'Initiates resuscitation and uterotonics (e.g. oxytocin)',
      'Performs uterine massage and assesses for retained products',
      'Escalates appropriately if bleeding continues',
    ],
    model_answer:
      'Declare a PPH and call for help. Resuscitate (large-bore IV access, fluids/blood, monitor). Identify the cause using the 4 Ts — uterine atony is most common, so give uterotonics (oxytocin) and perform bimanual uterine massage. Check for trauma and retained tissue, send bloods/crossmatch, and escalate to senior/obstetric and theatre if bleeding persists.',
  },
  {
    exam_type: 'AMC',
    external_ref: 'amc-psych-001',
    title: 'Acute agitation in the emergency department',
    stem: 'A 28-year-old man is brought to ED by police. He is agitated, talking about being watched, and is intermittently shouting. He has no clear medical history available.',
    vitals: 'HR 110, BP 142/88, afebrile; uncooperative with full examination.',
    marking_criteria: [
      'Prioritises safety of patient and staff (de-escalation first)',
      'Considers organic causes of acute behavioural disturbance',
      'Takes a collateral history and screens for substance use',
      'Knows a stepwise approach to acute sedation if needed',
      'Documents and arranges appropriate mental health review',
    ],
    model_answer:
      'Ensure safety with verbal de-escalation and adequate staff. Exclude organic causes of acute behavioural disturbance (hypoglycaemia, hypoxia, intoxication, head injury). Gather collateral history. If de-escalation fails and there is risk, follow a stepwise sedation protocol. Once settled, arrange a full assessment and mental health review with clear documentation.',
  },

  // ---------------- PESCI ----------------
  {
    exam_type: 'PESCI',
    external_ref: 'pesci-scope-001',
    title: 'Recognising the limits of your scope',
    stem: 'You are an IMG starting in an Australian general practice. A patient presents with a complex condition you have limited experience managing in this health system.',
    vitals: 'Not applicable — clinical judgement and safety scenario.',
    marking_criteria: [
      'Demonstrates insight into personal scope of practice',
      'Prioritises patient safety over independence',
      'Knows when and how to seek help or refer',
      'Understands local referral pathways and supervision',
      'Communicates honestly with the patient',
    ],
    model_answer:
      'Safe practice means recognising the limits of your competence and the local system. Acknowledge uncertainty, ensure immediate safety, and seek timely senior advice or refer through the correct pathway. Be honest with the patient about the plan, and use the experience to build familiarity with local guidelines and supervision arrangements.',
  },
  {
    exam_type: 'PESCI',
    external_ref: 'pesci-comm-001',
    title: 'Breaking bad news',
    stem: 'You need to inform a 62-year-old patient that their recent biopsy has confirmed a new cancer diagnosis. They have come to the appointment alone.',
    vitals: 'Not applicable — communication scenario.',
    marking_criteria: [
      'Uses a structured approach (e.g. SPIKES)',
      'Checks the patient\'s prior understanding and readiness',
      'Delivers information clearly, with empathy and pacing',
      'Responds to emotion and checks understanding',
      'Agrees a clear, supported follow-up plan',
    ],
    model_answer:
      'Use a framework such as SPIKES: prepare the setting, assess the patient\'s perception, obtain an invitation, give knowledge in plain language with a warning shot, respond to emotions empathically, and finish with a clear plan. Offer support, written information and a defined follow-up, and check understanding throughout.',
  },
]

async function main() {
  console.log('\nPassGP — seeding question bank')
  console.log('────────────────────────────────')

  if (!supabase) {
    console.log('  ✗ Supabase not configured (.env).')
    process.exit(1)
  }

  // Does the optional model_answer column exist?
  const probe = await supabase.from('exam_questions').select('model_answer').limit(1)
  const hasModelAnswer = !probe.error
  if (!hasModelAnswer) {
    console.log('  ! Column "model_answer" not found — seeding without it.')
    console.log('    To store model answers, run in the Supabase SQL editor:')
    console.log('    alter table public.exam_questions add column if not exists model_answer text;\n')
  }

  // Which external_refs already exist?
  const existing = await supabase.from('exam_questions').select('external_ref')
  const have = new Set((existing.data || []).map((r) => r.external_ref))

  const toInsert = QUESTIONS.filter((q) => !have.has(q.external_ref)).map((q) => {
    const row = {
      exam_type: q.exam_type,
      external_ref: q.external_ref,
      title: q.title,
      stem: q.stem,
      vitals: q.vitals,
      marking_criteria: q.marking_criteria,
      is_active: true,
    }
    if (hasModelAnswer) row.model_answer = q.model_answer
    return row
  })

  if (toInsert.length === 0) {
    console.log('  ✓ All sample questions already present. Nothing to add.')
  } else {
    const { data, error } = await supabase.from('exam_questions').insert(toInsert).select('id, exam_type, title')
    if (error) {
      console.log('  ✗ Insert failed:', error.message)
      process.exit(1)
    }
    console.log(`  ✓ Inserted ${data.length} question(s):`)
    data.forEach((q) => console.log(`     • [${q.exam_type}] ${q.title}`))
  }

  // Backfill model answers for existing rows (only if the column exists)
  if (hasModelAnswer) {
    let updated = 0
    for (const q of QUESTIONS) {
      const { error } = await supabase
        .from('exam_questions')
        .update({ model_answer: q.model_answer })
        .eq('external_ref', q.external_ref)
      if (!error) updated++
    }
    console.log(`  ✓ Model answers set on ${updated} question(s).`)
  }

  // Summary by exam type
  const all = await supabase.from('exam_questions').select('exam_type')
  const counts = {}
  ;(all.data || []).forEach((r) => (counts[r.exam_type] = (counts[r.exam_type] || 0) + 1))
  console.log('\n  Question bank totals:')
  Object.entries(counts).forEach(([k, v]) => console.log(`     ${k}: ${v}`))
  console.log('')
}

main().catch((e) => {
  console.log('  ✗ Error:', e.message)
  process.exit(1)
})
