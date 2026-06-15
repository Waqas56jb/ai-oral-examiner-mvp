import { useEffect, useMemo, useState } from 'react'
import {
  FiPlus, FiEdit2, FiTrash2, FiDownloadCloud, FiHelpCircle, FiCheck, FiX, FiAlertCircle, FiToggleLeft, FiToggleRight,
} from 'react-icons/fi'
import { supabase } from '../lib/supabase'
import { apiGet, apiPost } from '../lib/api'
import { Card, Button, IconButton, Badge, Search, EmptyState, PageLoader, Modal } from '../components/ui'
import QuestionForm, { rowToForm, formToPayload, blankQuestion } from '../components/QuestionForm'
import { fmtDate, toCsv, downloadFile } from '../lib/format'

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
    // Paginate (Supabase caps each request at 1000) so ALL questions load.
    let all = []
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('exam_questions')
        .select('id, title, exam_type, is_active, external_ref, marking_criteria')
        .order('title')
        .range(from, from + 999)
      if (error || !data) break
      all = all.concat(data)
      if (data.length < 1000) break
      from += 1000
    }
    setRows(all)
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

  const openNew = () => setEditing({ form: { ...blankQuestion }, id: null })
  const openEdit = async (r) => {
    const { data } = await supabase.from('exam_questions').select('*').eq('id', r.id).single()
    setEditing({ id: r.id, form: rowToForm(data || r) })
  }

  const save = async () => {
    const f = editing.form
    if (!f.title.trim() || !f.stem.trim()) {
      setError('Title and scenario are required.')
      return
    }
    setSaving(true)
    setError('')
    const payload = formToPayload(f)
    let err
    if (editing.id) {
      err = (await supabase.from('exam_questions').update(payload).eq('id', editing.id)).error
    } else {
      err = (await supabase.from('exam_questions').insert(payload).select('id').single()).error
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
          <QuestionForm
            form={editing.form}
            set={(k, v) => setEditing((s) => ({ ...s, form: { ...s.form, [k]: v } }))}
            categories={cats.filter((c) => c !== 'All')}
          />
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
  const [q, setQ] = useState('')
  const [sel, setSel] = useState({})
  const [err, setErr] = useState('')
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(null)
  const [result, setResult] = useState(null)

  useEffect(() => {
    apiGet('/api/admin/jotform/forms')
      .then((d) => setForms(d.forms || []))
      .catch((e) => { setErr(e.message); setForms([]) })
  }, [])

  const filtered = useMemo(() => {
    if (!forms) return []
    const t = q.trim().toLowerCase()
    return t ? forms.filter((f) => f.title.toLowerCase().includes(t)) : forms
  }, [forms, q])

  const toggle = (id) => setSel((s) => ({ ...s, [id]: !s[id] }))
  const selectedForms = forms ? forms.filter((f) => sel[f.id]) : []

  // Import in client-side batches so thousands of cases import without timing out.
  const runImport = async (list) => {
    setRunning(true); setErr(''); setResult(null)
    const BATCH = 25
    let imported = 0, updated = 0, failed = 0
    for (let i = 0; i < list.length; i += BATCH) {
      const chunk = list.slice(i, i + BATCH).map((f) => ({ id: f.id, title: f.title }))
      try {
        const d = await apiPost('/api/admin/jotform/import', { forms: chunk })
        imported += d.imported || 0; updated += d.updated || 0; failed += d.failed || 0
      } catch {
        failed += chunk.length
      }
      setProgress({ done: Math.min(i + BATCH, list.length), total: list.length, imported, updated, failed })
    }
    setRunning(false)
    setResult({ imported, updated, failed, total: list.length })
    onDone()
  }

  return (
    <Modal
      wide
      title="Import questions from Jotform"
      onClose={running ? () => {} : onClose}
      footer={
        result ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" disabled={running} onClick={onClose}>Cancel</Button>
            <Button variant="soft" loading={running} disabled={!forms?.length} onClick={() => runImport(forms)}>
              Import all ({forms?.length || 0})
            </Button>
            <Button loading={running} disabled={selectedForms.length === 0} onClick={() => runImport(selectedForms)} icon={<FiDownloadCloud />}>
              Import selected ({selectedForms.length})
            </Button>
          </>
        )
      }
    >
      {err && <div className="alert alert--error"><FiAlertCircle /> {err}</div>}

      {result ? (
        <div className="alert alert--success">
          <FiCheck />
          <div>Imported <strong>{result.imported}</strong>, updated <strong>{result.updated}</strong>{result.failed ? `, ${result.failed} skipped` : ''} of {result.total}.</div>
        </div>
      ) : running ? (
        <div>
          <p className="muted">Importing the question bank… keep this tab open until it finishes.</p>
          <div style={{ height: 10, background: 'var(--line)', borderRadius: 999, overflow: 'hidden', margin: '14px 0' }}>
            <div style={{ height: '100%', width: `${progress ? Math.round((progress.done / progress.total) * 100) : 0}%`, background: 'var(--grad)', transition: 'width .3s' }} />
          </div>
          {progress && (
            <p className="muted" style={{ textAlign: 'center' }}>
              {progress.done} / {progress.total} · imported {progress.imported}, updated {progress.updated}, failed {progress.failed}
            </p>
          )}
        </div>
      ) : forms === null ? (
        <div className="loader-full" style={{ minHeight: 180 }}><div className="loader-dots"><span /><span /><span /></div></div>
      ) : forms.length === 0 ? (
        <EmptyState title="No case forms found" text="Make sure JOTFORM_API_KEY is set on the server." />
      ) : (
        <>
          <p className="muted">
            <strong>{forms.length.toLocaleString()}</strong> clinical case forms found on Jotform. Import the whole bank, or search & select specific cases.
          </p>
          <Search value={q} onChange={setQ} placeholder="Search cases by title…" />
          <div className="scrollbox" style={{ border: '1px solid var(--line)', borderRadius: 12, marginTop: 10 }}>
            {filtered.slice(0, 300).map((f) => (
              <label key={f.id} className="flex items-center gap" style={{ padding: '11px 14px', borderBottom: '1px solid var(--line-2)', cursor: 'pointer' }}>
                <input type="checkbox" checked={!!sel[f.id]} onChange={() => toggle(f.id)} style={{ width: 17, height: 17, accentColor: 'var(--accent)' }} />
                <span className="tbl__primary">{f.title}</span>
                <span className="muted" style={{ marginLeft: 'auto', fontSize: '0.8rem' }}>#{f.id}</span>
              </label>
            ))}
            {filtered.length > 300 && (
              <div className="muted" style={{ padding: 12, textAlign: 'center', fontSize: '0.85rem' }}>
                Showing first 300 of {filtered.length.toLocaleString()}. Use search to narrow down, or just “Import all”.
              </div>
            )}
          </div>
        </>
      )}
    </Modal>
  )
}
