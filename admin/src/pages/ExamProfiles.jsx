import { useEffect, useState } from 'react'
import { FiUserCheck, FiSave, FiCheck, FiAlertCircle, FiEdit2 } from 'react-icons/fi'
import { apiGet, apiPut } from '../lib/api'
import { Card, Button, Badge, PageLoader, EmptyState, Modal, Field } from '../components/ui'

const MODES = [
  { value: 'both', label: 'Examiner + Patient (dual)' },
  { value: 'examiner', label: 'Examiner only' },
  { value: 'patient', label: 'Patient simulation only' },
]

export default function ExamProfiles() {
  const [rows, setRows] = useState(null)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const { profiles } = await apiGet('/api/admin/exam-profiles')
      setRows(profiles || [])
    } catch (e) {
      setError(e.message); setRows([])
    }
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    setSaving(true); setError('')
    try {
      await apiPut(`/api/admin/exam-profiles/${encodeURIComponent(editing.exam_key)}`, {
        label: editing.label,
        examiner_instructions: editing.examiner_instructions,
        prep_seconds: editing.prep_minutes ? Number(editing.prep_minutes) * 60 : null,
        consult_seconds: editing.consult_minutes ? Number(editing.consult_minutes) * 60 : null,
        standard: editing.standard,
        mark_scheme: editing.mark_scheme,
        critical_fail: editing.critical_fail,
        common_errors: editing.common_errors,
        evidence_base: editing.evidence_base,
        model_answer: editing.model_answer,
        teaching_notes: editing.teaching_notes,
        mode: editing.mode,
        enabled: editing.enabled,
      })
      setEditing(null)
      setSaved(true); setTimeout(() => setSaved(false), 2500)
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (rows === null) return <PageLoader />

  return (
    <>
      <div className="page-head">
        <div><h2>Exam Profiles</h2><p>Give each exam its own examiner personality — candidates pick the exam, the examiner adopts its profile</p></div>
        {saved && <span className="badge badge--green"><FiCheck /> Saved</span>}
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: 16 }}><FiAlertCircle /> {error}</div>}

      {rows.length === 0 ? (
        <Card><EmptyState icon={<FiUserCheck />} title="No exams yet" text="Push some cases into the Training Panel — the exams they belong to (e.g. ACRRM, RACGP CCE) appear here to give a personality." /></Card>
      ) : (
        <Card>
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Exam</th><th>Cases</th><th>Role</th><th>Personality</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.exam_key}>
                    <td className="tbl__primary">{r.label}</td>
                    <td className="mono">{r.caseCount}</td>
                    <td>{MODES.find((m) => m.value === r.mode)?.label || r.mode}</td>
                    <td className="muted" style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.examiner_instructions ? r.examiner_instructions : <em>No personality set — using the default</em>}
                    </td>
                    <td>{r.enabled ? <Badge color="green" dot>Available</Badge> : <Badge color="slate">Hidden</Badge>}</td>
                    <td style={{ textAlign: 'right' }}>
                      <Button size="sm" variant="ghost" icon={<FiEdit2 />} onClick={() => setEditing({ ...r, prep_minutes: r.prep_seconds ? Math.round(r.prep_seconds / 60) : '', consult_minutes: r.consult_seconds ? Math.round(r.consult_seconds / 60) : '' })}>Edit</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {editing && (
        <Modal
          wide
          title={`Examiner profile — ${editing.label}`}
          onClose={() => setEditing(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button loading={saving} icon={<FiSave />} onClick={save}>Save profile</Button>
            </>
          }
        >
          <p className="muted" style={{ marginBottom: 14 }}>
            {editing.caseCount} case{editing.caseCount === 1 ? '' : 's'} are tagged to this exam. Candidates who pick <strong>{editing.label}</strong> get this examiner.
          </p>

          <Field label="Display name">
            <input className="input" value={editing.label} onChange={(e) => setEditing((s) => ({ ...s, label: e.target.value }))} />
          </Field>

          <Field label="Examiner role">
            <select className="select" value={editing.mode} onChange={(e) => setEditing((s) => ({ ...s, mode: e.target.value }))}>
              {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </Field>

          <Field label="Examiner personality / how to run this exam">
            <textarea
              className="textarea"
              style={{ minHeight: 110 }}
              value={editing.examiner_instructions}
              onChange={(e) => setEditing((s) => ({ ...s, examiner_instructions: e.target.value }))}
              placeholder={'e.g. For the CCE patient exam, play a patient who is anxious and talkative. As a StAMPS examiner, focus hard on emergencies and rural safety…'}
            />
          </Field>

          <p className="muted" style={{ fontSize: '0.84rem', margin: '4px 0 10px' }}>
            <strong>Exam-wide defaults</strong> — these apply the same format/standard to <strong>every case in {editing.label}</strong> (they mirror the case editor fields, at exam level).
          </p>

          <div className="grid grid-2" style={{ gap: 16 }}>
            <Field label="Preparation time (minutes)">
              <input className="input" type="number" min="0" value={editing.prep_minutes ?? ''} onChange={(e) => setEditing((s) => ({ ...s, prep_minutes: e.target.value }))} />
            </Field>
            <Field label="Consultation time (minutes)">
              <input className="input" type="number" min="0" value={editing.consult_minutes ?? ''} onChange={(e) => setEditing((s) => ({ ...s, consult_minutes: e.target.value }))} />
            </Field>
          </div>

          <Field label="Expected candidate standard">
            <textarea className="textarea" style={{ minHeight: 100 }} value={editing.standard || ''} onChange={(e) => setEditing((s) => ({ ...s, standard: e.target.value }))} placeholder="What a good candidate does at this level — the bar the examiner probes to." />
          </Field>

          <Field label="Marking rubric">
            <textarea className="textarea" style={{ minHeight: 100 }} value={editing.mark_scheme || ''} onChange={(e) => setEditing((s) => ({ ...s, mark_scheme: e.target.value }))} placeholder="How this exam is marked (e.g. each case against its criteria; pass needs safety + management)." />
          </Field>

          <Field label="Critical fail criteria">
            <textarea className="textarea" style={{ minHeight: 90 }} value={editing.critical_fail || ''} onChange={(e) => setEditing((s) => ({ ...s, critical_fail: e.target.value }))} placeholder="What causes an automatic fail in this exam (unsafe acts, missed killer steps)." />
          </Field>

          <Field label="Common candidate errors">
            <textarea className="textarea" style={{ minHeight: 90 }} value={editing.common_errors || ''} onChange={(e) => setEditing((s) => ({ ...s, common_errors: e.target.value }))} placeholder="Typical mistakes — so the examiner probes and the grader spots them." />
          </Field>

          <Field label="Evidence base / references">
            <textarea className="textarea" style={{ minHeight: 80 }} value={editing.evidence_base || ''} onChange={(e) => setEditing((s) => ({ ...s, evidence_base: e.target.value }))} placeholder="Guidelines / sources this exam follows (RACGP, ACRRM, NICE…)." />
          </Field>

          <Field label="Model answer">
            <textarea className="textarea" style={{ minHeight: 90 }} value={editing.model_answer || ''} onChange={(e) => setEditing((s) => ({ ...s, model_answer: e.target.value }))} placeholder="A model answer / approach for this exam (examiner reference)." />
          </Field>

          <Field label="Teaching notes for AI">
            <textarea className="textarea" style={{ minHeight: 90 }} value={editing.teaching_notes || ''} onChange={(e) => setEditing((s) => ({ ...s, teaching_notes: e.target.value }))} placeholder="Any extra guidance for the AI on how to run / mark this exam." />
          </Field>
          <p className="muted" style={{ fontSize: '0.82rem', marginTop: -4 }}>
            These train both the live examiner (what to probe for) and the grader (how to decide pass/fail) for every {editing.label} session.
          </p>

          <label className="auth-check" style={{ marginTop: 4 }}>
            <input type="checkbox" checked={editing.enabled} onChange={(e) => setEditing((s) => ({ ...s, enabled: e.target.checked }))} /> Available for candidates to choose
          </label>
        </Modal>
      )}
    </>
  )
}
