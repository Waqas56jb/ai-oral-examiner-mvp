import { Field, AutoTextarea } from './ui'

export const PATHWAYS = [
  'RACGP CCE',
  'StAMPS (ACRRM)',
  'AMC Clinical',
  'PESCI',
  'RANZCOG OSCE',
  'RACP Clinical',
  'KFP',
  'AKT',
  'NZREX',
  'Other',
]

export const blankQuestion = {
  title: '',
  exam_type: '',
  pathway: '',
  candidate_instructions: '',
  stem: '',
  patient_script: '',
  marking_criteria: '', // textarea, one per line
  model_answer: '',
  examiner_instructions: '',
  red_flags: '',
  killer_marks: '',
  feedback_points: '',
  total_marks: 10,
  pass_mark: 5,
  duration_minutes: 8,
  status: 'draft',
}

export const STATUSES = [
  { value: 'draft', label: 'Draft', color: 'amber' },
  { value: 'active', label: 'Active', color: 'green' },
  { value: 'disabled', label: 'Disabled', color: 'slate' },
  { value: 'archived', label: 'Archived', color: 'slate' },
]

/** Map a DB row into the editable form shape. */
export function rowToForm(d = {}) {
  return {
    title: d.title || '',
    exam_type: d.exam_type || '',
    pathway: d.pathway || '',
    candidate_instructions: d.candidate_instructions || '',
    stem: d.stem || '',
    patient_script: d.patient_script || '',
    marking_criteria: (d.marking_criteria || []).join('\n'),
    model_answer: d.model_answer || '',
    examiner_instructions: d.examiner_instructions || '',
    red_flags: d.red_flags || '',
    killer_marks: d.killer_marks || '',
    feedback_points: d.feedback_points || '',
    total_marks: d.total_marks ?? 10,
    pass_mark: d.pass_mark ?? 5,
    prep_minutes: d.prep_seconds ? Math.round(d.prep_seconds / 60) : 2,
    duration_minutes: d.duration_seconds ? Math.round(d.duration_seconds / 60) : 8,
    expected_standard: d.expected_standard || '',
    common_errors: d.common_errors || '',
    evidence_base: d.evidence_base || '',
    teaching_notes: d.teaching_notes || '',
    status: d.status || (d.is_active === false ? 'disabled' : 'active'),
  }
}

/** Build the DB payload from the form. */
export function formToPayload(f) {
  return {
    title: f.title.trim(),
    exam_type: f.exam_type.trim() || 'General',
    pathway: f.pathway || null,
    candidate_instructions: f.candidate_instructions.trim() || null,
    stem: f.stem.trim(),
    patient_script: f.patient_script.trim() || null,
    marking_criteria: f.marking_criteria.split('\n').map((s) => s.trim()).filter(Boolean),
    model_answer: f.model_answer || null,
    examiner_instructions: f.examiner_instructions.trim() || null,
    red_flags: f.red_flags.trim() || null,
    killer_marks: f.killer_marks.trim() || null,
    feedback_points: f.feedback_points.trim() || null,
    total_marks: Math.max(1, Number(f.total_marks) || 10),
    pass_mark: Math.max(0, Number(f.pass_mark) || 0),
    prep_seconds: Math.max(0, (Number(f.prep_minutes) || 0) * 60),
    duration_seconds: Math.max(60, (Number(f.duration_minutes) || 8) * 60),
    expected_standard: (f.expected_standard || '').trim() || null,
    common_errors: (f.common_errors || '').trim() || null,
    evidence_base: (f.evidence_base || '').trim() || null,
    teaching_notes: (f.teaching_notes || '').trim() || null,
    status: f.status || 'draft',
    // keep is_active in sync for backward compatibility (only 'active' is live)
    is_active: f.status === 'active',
  }
}

export default function QuestionForm({ form, set, categories = [] }) {
  const f = (k) => (e) => set(k, e.target.value)
  return (
    <>
      <div className="grid grid-2" style={{ gap: 16 }}>
        <Field label="Case title">
          <input className="input" value={form.title} onChange={f('title')} placeholder="Acute chest pain…" />
        </Field>
        <Field label="Category / specialty">
          <input className="input" value={form.exam_type} onChange={f('exam_type')} placeholder="e.g. Cardiovascular" list="pgp-cats" />
          <datalist id="pgp-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
      </div>

      <Field label="Exam pathway">
        <select className="select" value={form.pathway} onChange={f('pathway')}>
          <option value="">— Select pathway —</option>
          {PATHWAYS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </Field>

      <Field label="Candidate instructions (what the candidate is told)">
        <AutoTextarea value={form.candidate_instructions} onChange={f('candidate_instructions')} maxHeight={240} placeholder="You are a GP. A patient presents with… You have 8 minutes." />
      </Field>

      <Field label="Clinical scenario / stem">
        <AutoTextarea value={form.stem} onChange={f('stem')} maxHeight={320} minHeight={110} placeholder="A 54-year-old man presents with…" />
      </Field>

      <Field label="Patient script (the AI plays the patient from this — it only reveals info when asked)">
        <AutoTextarea value={form.patient_script} onChange={f('patient_script')} maxHeight={300} placeholder="Opening line, history, hidden concerns, what to reveal only when asked…" />
      </Field>

      <div className="grid grid-2" style={{ gap: 16 }}>
        <Field label="Total marks">
          <input className="input" type="number" min="1" value={form.total_marks} onChange={f('total_marks')} />
        </Field>
        <Field label="Pass mark">
          <input className="input" type="number" min="0" value={form.pass_mark} onChange={f('pass_mark')} />
        </Field>
        <Field label="Preparation time (minutes)">
          <input className="input" type="number" min="0" value={form.prep_minutes} onChange={f('prep_minutes')} />
        </Field>
        <Field label="Consultation time (minutes)">
          <input className="input" type="number" min="1" value={form.duration_minutes} onChange={f('duration_minutes')} />
        </Field>
      </div>

      <Field label="Tasks / marking rubric (one per line)">
        <AutoTextarea value={form.marking_criteria} onChange={f('marking_criteria')} maxHeight={260} placeholder={'Takes a focused history\nReaches the correct diagnosis\nSafe management plan'} />
      </Field>

      <Field label="Expected answers / model answer (examiner only)">
        <AutoTextarea value={form.model_answer} onChange={f('model_answer')} maxHeight={260} placeholder="The reference answer used to grade…" />
      </Field>

      <Field label="Examiner instructions (examiner only)">
        <AutoTextarea value={form.examiner_instructions} onChange={f('examiner_instructions')} maxHeight={200} placeholder="How to run the station, when to reveal findings, prompts to use…" />
      </Field>

      <div className="grid grid-2" style={{ gap: 16 }}>
        <Field label="Red flags (must be identified)">
          <AutoTextarea value={form.red_flags} onChange={f('red_flags')} maxHeight={180} placeholder="Chest pain + sweating, weight loss…" />
        </Field>
        <Field label="Killer / unsafe marks (auto-fail if missed or violated)">
          <AutoTextarea value={form.killer_marks} onChange={f('killer_marks')} maxHeight={180} placeholder="e.g. Fails to give adrenaline in anaphylaxis · Misses sepsis · Unsafe prescribing" />
        </Field>
      </div>

      <Field label="Feedback points">
        <AutoTextarea value={form.feedback_points} onChange={f('feedback_points')} maxHeight={180} placeholder="Key teaching points for feedback…" />
      </Field>

      <Field label="Expected candidate standard">
        <AutoTextarea value={form.expected_standard} onChange={f('expected_standard')} maxHeight={180} placeholder="What a good candidate does at this level — the bar the examiner probes to." />
      </Field>

      <Field label="Common candidate errors">
        <AutoTextarea value={form.common_errors} onChange={f('common_errors')} maxHeight={180} placeholder="Typical mistakes — so the examiner can probe and the grader can spot them." />
      </Field>

      <Field label="Evidence base / references">
        <AutoTextarea value={form.evidence_base} onChange={f('evidence_base')} maxHeight={160} placeholder="Guidelines / sources this case is based on (RANZCOG, NICE…)." />
      </Field>

      <Field label="Teaching notes for AI">
        <AutoTextarea value={form.teaching_notes} onChange={f('teaching_notes')} maxHeight={180} placeholder="Any extra guidance for the AI examiner on how to run / mark this case." />
      </Field>

      <Field label="Status">
        <select className="select" value={form.status} onChange={f('status')}>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <p className="muted" style={{ fontSize: '0.8rem', marginTop: 6 }}>
          Only <strong>Active</strong> cases are available to candidates. Draft = work in progress, Disabled = temporarily off, Archived = retired.
        </p>
      </Field>
    </>
  )
}
