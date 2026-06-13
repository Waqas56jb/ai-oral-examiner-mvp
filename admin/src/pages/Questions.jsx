import { useEffect, useMemo, useState } from 'react'
import {
  FiPlus, FiEdit2, FiTrash2, FiDownloadCloud, FiHelpCircle, FiCheck, FiX, FiAlertCircle, FiToggleLeft, FiToggleRight,
} from 'react-icons/fi'
import { supabase } from '../lib/supabase'
import { apiGet, apiPost } from '../lib/api'
import { Card, Button, IconButton, Badge, Search, EmptyState, PageLoader, Modal, Field } from '../components/ui'
import { fmtDate, toCsv, downloadFile } from '../lib/format'

const EXAM_TYPES = ['RACGP', 'ACRRM', 'AMC', 'PESCI', 'NZREX', 'KFP', 'AKT']
const blank = { title: '', exam_type: 'RACGP', stem: '', vitals: '', marking_criteria: '', model_answer: '', is_active: true }

export default function Questions() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('All')
  const [editing, setEditing] = useState(null) // {form, id?}
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('exam_questions').select('*').order('created_at', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const cats = useMemo(() => {
    const set = new Set()
    rows.forEach((r) => r.exam_type && set.add(r.exam_type))
    return ['All', ...Array.from(set)]
  }, [rows])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (cat !== 'All' && r.exam_type !== cat) return false
      if (!term) return true
      return `${r.title} ${r.stem} ${r.external_ref}`.toLowerCase().includes(term)
    })
  }, [rows, q, cat])

  const openNew = () => setEditing({ form: { ...blank }, id: null })
  const openEdit = (r) =>
    setEditing({
      id: r.id,
      form: {
        title: r.title || '',
        exam_type: r.exam_type || 'RACGP',
        stem: r.stem || '',
        vitals: r.vitals || '',
        marking_criteria: (r.marking_criteria || []).join('\n'),
        model_answer: r.model_answer || '',
        is_active: r.is_active,
      },
    })

  const save = async () => {
    const f = editing.form
    if (!f.title.trim() || !f.stem.trim()) {
      setError('Title and scenario are required.')
      return
    }
    setSaving(true)
    setError('')
    const payload = {
      title: f.title.trim(),
      exam_type: f.exam_type,
      stem: f.stem.trim(),
      vitals: f.vitals.trim(),
      marking_criteria: f.marking_criteria.split('\n').map((s) => s.trim()).filter(Boolean),
      is_active: f.is_active,
    }
    let err
    if (editing.id) {
      const r1 = await supabase.from('exam_questions').update(payload).eq('id', editing.id)
      err = r1.error
      await supabase.from('exam_questions').update({ model_answer: f.model_answer }).eq('id', editing.id)
    } else {
      const ins = await supabase.from('exam_questions').insert(payload).select('id').single()
      err = ins.error
      if (!err && ins.data) await supabase.from('exam_questions').update({ model_answer: f.model_answer }).eq('id', ins.data.id)
    }
    setSaving(false)
    if (err) { setError(err.message); return }
    setEditing(null)
    load()
  }

  const toggleActive = async (r) => {
    await supabase.from('exam_questions').update({ is_active: !r.is_active }).eq('id', r.id)
    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, is_active: !x.is_active } : x)))
  }

  const doDelete = async () => {
    await supabase.from('exam_questions').delete().eq('id', confirmDel.id)
    setConfirmDel(null)
    load()
  }

  const exportCsv = () => {
    const csv = toCsv(filtered, [
      { label: 'Title', key: 'title' },
      { label: 'Exam', key: 'exam_type' },
      { label: 'Active', get: (r) => (r.is_active ? 'yes' : 'no') },
      { label: 'Ref', key: 'external_ref' },
    ])
    downloadFile(`passgp-questions-${Date.now()}.csv`, csv, 'text/csv')
  }

  if (loading) return <PageLoader />

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Question Bank</h2>
          <p>{rows.length} questions · {rows.filter((r) => r.is_active).length} active</p>
        </div>
        <div className="page-actions">
          <Button variant="ghost" icon={<FiDownloadCloud />} onClick={() => setImportOpen(true)}>Import from Jotform</Button>
          <Button variant="ghost" onClick={exportCsv}>Export CSV</Button>
          <Button icon={<FiPlus />} onClick={openNew}>Add question</Button>
        </div>
      </div>

      <div className="toolbar">
        <Search value={q} onChange={setQ} placeholder="Search questions…" />
        <div className="flex gap" style={{ flexWrap: 'wrap' }}>
          {cats.map((c) => (
            <button key={c} className={`chip ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
      </div>

      <Card bodyClass="" >
        {filtered.length === 0 ? (
          <EmptyState icon={<FiHelpCircle />} title="No questions found" text="Add a question or import your case bank from Jotform." />
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Case title</th><th>Exam</th><th>Tasks</th><th>Source</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="tbl__primary" style={{ maxWidth: 320 }}>{r.title}</td>
                    <td><Badge color="violet">{r.exam_type}</Badge></td>
                    <td className="mono">{(r.marking_criteria || []).length}</td>
                    <td className="muted">{r.external_ref ? 'Jotform' : 'Manual'}</td>
                    <td>
                      <button className="badge" onClick={() => toggleActive(r)} style={{ cursor: 'pointer', background: r.is_active ? '#d1fae5' : '#f1f5f9', color: r.is_active ? '#047857' : '#64748b' }}>
                        {r.is_active ? <FiToggleRight /> : <FiToggleLeft />} {r.is_active ? 'Active' : 'Disabled'}
                      </button>
                    </td>
                    <td>
                      <div className="flex" style={{ justifyContent: 'flex-end', gap: 4 }}>
                        <IconButton icon={<FiEdit2 />} onClick={() => openEdit(r)} title="Edit" />
                        <IconButton icon={<FiTrash2 />} danger onClick={() => setConfirmDel(r)} title="Delete" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Edit / Add modal */}
      {editing && (
        <Modal
          wide
          title={editing.id ? 'Edit question' : 'New question'}
          onClose={() => { setEditing(null); setError('') }}
          footer={
            <>
              <Button variant="ghost" onClick={() => { setEditing(null); setError('') }}>Cancel</Button>
              <Button loading={saving} onClick={save} icon={<FiCheck />}>Save question</Button>
            </>
          }
        >
          {error && <div className="alert alert--error"><FiAlertCircle /> {error}</div>}
          <div className="grid grid-2" style={{ gap: 16 }}>
            <Field label="Case title">
              <input className="input" value={editing.form.title} onChange={(e) => setEditing((s) => ({ ...s, form: { ...s.form, title: e.target.value } }))} placeholder="Acute chest pain…" />
            </Field>
            <Field label="Exam type">
              <select className="select" value={editing.form.exam_type} onChange={(e) => setEditing((s) => ({ ...s, form: { ...s.form, exam_type: e.target.value } }))}>
                {EXAM_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Clinical scenario (presented to the candidate)">
            <textarea className="textarea" value={editing.form.stem} onChange={(e) => setEditing((s) => ({ ...s, form: { ...s.form, stem: e.target.value } }))} placeholder="A 54-year-old man presents with…" />
          </Field>
          <Field label="Tasks / questions to ask (one per line)">
            <textarea className="textarea" value={editing.form.marking_criteria} onChange={(e) => setEditing((s) => ({ ...s, form: { ...s.form, marking_criteria: e.target.value } }))} placeholder={'Take a focused history\nExplain the diagnosis\nDiscuss management'} />
          </Field>
          <Field label="Model answer / marking key (examiner only — never shown to candidate)">
            <textarea className="textarea" value={editing.form.model_answer} onChange={(e) => setEditing((s) => ({ ...s, form: { ...s.form, model_answer: e.target.value } }))} placeholder="Reference answer used by the AI to grade…" />
          </Field>
          <label className="auth-check">
            <input type="checkbox" checked={editing.form.is_active} onChange={(e) => setEditing((s) => ({ ...s, form: { ...s.form, is_active: e.target.checked } }))} />
            Active (available to candidates)
          </label>
        </Modal>
      )}

      {/* Delete confirm */}
      {confirmDel && (
        <Modal
          title="Delete question?"
          onClose={() => setConfirmDel(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmDel(null)}>Cancel</Button>
              <Button variant="danger" icon={<FiTrash2 />} onClick={doDelete}>Delete permanently</Button>
            </>
          }
        >
          <p>You're about to delete <strong>{confirmDel.title}</strong>. This cannot be undone.</p>
        </Modal>
      )}

      {importOpen && <ImportModal onClose={() => setImportOpen(false)} onDone={load} />}
    </>
  )
}

function ImportModal({ onClose, onDone }) {
  const [forms, setForms] = useState(null)
  const [sel, setSel] = useState({})
  const [err, setErr] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    apiGet('/api/admin/jotform/forms')
      .then((d) => setForms(d.forms || []))
      .catch((e) => { setErr(e.message); setForms([]) })
  }, [])

  const toggle = (id) => setSel((s) => ({ ...s, [id]: !s[id] }))
  const selectedIds = Object.keys(sel).filter((k) => sel[k])

  const run = async (all) => {
    setImporting(true)
    setErr('')
    try {
      const body = all ? {} : { formIds: selectedIds }
      const d = await apiPost('/api/admin/jotform/import', body)
      setResult(d)
      onDone()
    } catch (e) {
      setErr(e.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <Modal
      wide
      title="Import questions from Jotform"
      onClose={onClose}
      footer={
        result ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="soft" loading={importing} onClick={() => run(true)}>Import all cases</Button>
            <Button loading={importing} disabled={selectedIds.length === 0} onClick={() => run(false)} icon={<FiDownloadCloud />}>
              Import selected ({selectedIds.length})
            </Button>
          </>
        )
      }
    >
      {err && <div className="alert alert--error"><FiAlertCircle /> {err}</div>}
      {result ? (
        <div className="alert alert--success">
          <FiCheck />
          <div>Imported <strong>{result.imported}</strong>, updated <strong>{result.updated}</strong>{result.failed ? `, ${result.failed} skipped` : ''} (of {result.total}).</div>
        </div>
      ) : forms === null ? (
        <div className="loader-full" style={{ minHeight: 180 }}><div className="loader-dots"><span /><span /><span /></div></div>
      ) : forms.length === 0 ? (
        <EmptyState title="No case forms found" text="Make sure JOTFORM_API_KEY is set on the server." />
      ) : (
        <>
          <p className="muted" style={{ marginBottom: 4 }}>{forms.length} clinical case forms found. Select the ones to import, or import all.</p>
          <div className="scrollbox" style={{ border: '1px solid var(--line)', borderRadius: 12 }}>
            {forms.map((f) => (
              <label key={f.id} className="flex items-center gap" style={{ padding: '11px 14px', borderBottom: '1px solid var(--line-2)', cursor: 'pointer' }}>
                <input type="checkbox" checked={!!sel[f.id]} onChange={() => toggle(f.id)} style={{ width: 17, height: 17, accentColor: 'var(--accent)' }} />
                <span className="tbl__primary">{f.title}</span>
                <span className="muted" style={{ marginLeft: 'auto', fontSize: '0.8rem' }}>#{f.id}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </Modal>
  )
}
