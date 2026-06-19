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
        mark_scheme: editing.mark_scheme,
        standard: editing.standard,
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
                      <Button size="sm" variant="ghost" icon={<FiEdit2 />} onClick={() => setEditing({ ...r })}>Edit</Button>
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
              style={{ minHeight: 130 }}
              value={editing.examiner_instructions}
              onChange={(e) => setEditing((s) => ({ ...s, examiner_instructions: e.target.value }))}
              placeholder={'e.g. For the CCE patient exam, play a patient who is anxious and talkative. As a StAMPS examiner, focus hard on emergencies and rural safety…'}
            />
          </Field>

          <Field label="What mark scheme am I using?">
            <textarea
              className="textarea"
              style={{ minHeight: 110 }}
              value={editing.mark_scheme || ''}
              onChange={(e) => setEditing((s) => ({ ...s, mark_scheme: e.target.value }))}
              placeholder={'e.g. Each case is marked against its criteria. 8 stations, each scored independently. A pass needs a satisfactory rating in safety and management across the circuit.'}
            />
          </Field>

          <Field label="What is the standard for this exam, and how would a good candidate answer?">
            <textarea
              className="textarea"
              style={{ minHeight: 130 }}
              value={editing.standard || ''}
              onChange={(e) => setEditing((s) => ({ ...s, standard: e.target.value }))}
              placeholder={'e.g. A good StAMPS candidate works safely with limited resources, escalates/retrieves appropriately, gives specific drug doses, and communicates a clear plan. Pass = covers the critical safety steps and the core management; fail = misses a killer step or is unsafe.'}
            />
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
