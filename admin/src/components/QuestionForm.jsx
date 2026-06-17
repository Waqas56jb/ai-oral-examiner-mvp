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
  is_active: true,
}

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
    duration_minutes: d.duration_seconds ? Math.round(d.duration_seconds / 60) : 8,
    is_active: d.is_active ?? true,
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
    duration_seconds: Math.max(60, (Number(f.duration_minutes) || 8) * 60),
    is_active: f.is_active,
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

      <div className="grid grid-3" style={{ gap: 16 }}>
        <Field label="Total marks">
          <input className="input" type="number" min="1" value={form.total_marks} onChange={f('total_marks')} />
        </Field>
        <Field label="Pass mark">
          <input className="input" type="number" min="0" value={form.pass_mark} onChange={f('pass_mark')} />
        </Field>
        <Field label="Time limit (minutes)">
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

      <label className="auth-check">
        <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} /> Active (available to candidates)
      </label>
    </>
  )
}
