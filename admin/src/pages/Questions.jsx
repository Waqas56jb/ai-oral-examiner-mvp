import { useEffect, useMemo, useState } from 'react'
import {
  FiPlus, FiEdit2, FiTrash2, FiDownloadCloud, FiUpload, FiHelpCircle, FiCheck, FiAlertCircle, FiPlay, FiExternalLink, FiTag,
} from 'react-icons/fi'
import { supabase } from '../lib/supabase'
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from '../lib/api'
import { Card, Button, IconButton, Badge, Search, EmptyState, PageLoader, Modal } from '../components/ui'
import QuestionForm, { rowToForm, formToPayload, blankQuestion } from '../components/QuestionForm'
import { fmtDate, toCsv, parseCsv, downloadFile } from '../lib/format'
import { matchesSearch } from '../lib/search'

// Full case CSV schema (#9). Order = column order in the exported file.
const CSV_COLS = [
  'external_ref', 'title', 'exam_type', 'pathway', 'status',
  'candidate_instructions', 'stem', 'patient_script',
  'marking_criteria', 'model_answer', 'examiner_instructions',
  'red_flags', 'killer_marks', 'feedback_points',
  'total_marks', 'pass_mark', 'duration_seconds',
]
// Chatbot app URL (for launching a live test session). Override with VITE_CHATBOT_URL.
const CHATBOT_URL = (import.meta.env.VITE_CHATBOT_URL || 'https://ai-oral-examiner-mvp-chatbot.vercel.app').replace(/\/$/, '')

// marking_criteria is an array in the DB — represent it in one CSV cell.
const joinCriteria = (v) => (Array.isArray(v) ? v.join(' | ') : v || '')
const splitCriteria = (v) => String(v || '').split(/\s*\|\s*|\n/).map((s) => s.trim()).filter(Boolean)

function rowToCsvObj(r) {
  const o = {}
  CSV_COLS.forEach((c) => { o[c] = c === 'marking_criteria' ? joinCriteria(r.marking_criteria) : (r[c] ?? '') })
  return o
}
function csvObjToPayload(o) {
  return {
    external_ref: o.external_ref?.trim() || null,
    title: (o.title || '').trim(),
    exam_type: (o.exam_type || '').trim() || 'General',
    pathway: o.pathway?.trim() || null,
    status: ['draft', 'active', 'disabled', 'archived'].includes((o.status || '').trim()) ? o.status.trim() : 'draft',
    is_active: (o.status || '').trim() === 'active',
    candidate_instructions: o.candidate_instructions?.trim() || null,
    stem: (o.stem || '').trim(),
    patient_script: o.patient_script?.trim() || null,
    marking_criteria: splitCriteria(o.marking_criteria),
    model_answer: o.model_answer?.trim() || null,
    examiner_instructions: o.examiner_instructions?.trim() || null,
    red_flags: o.red_flags?.trim() || null,
    killer_marks: o.killer_marks?.trim() || null,
    feedback_points: o.feedback_points?.trim() || null,
    total_marks: Number(o.total_marks) > 0 ? Number(o.total_marks) : 10,
    pass_mark: o.pass_mark !== '' && o.pass_mark != null ? Number(o.pass_mark) : 5,
    duration_seconds: Number(o.duration_seconds) > 0 ? Number(o.duration_seconds) : 480,
  }
}

export default function Questions() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('All')
  const [editing, setEditing] = useState(null) // {form, id?}
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const [csvOpen, setCsvOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [preview, setPreview] = useState(null) // full case object
  const [error, setError] = useState('')

  const openPreview = async (r) => {
    try {
      const { question } = await apiGet(`/api/admin/questions/${r.id}`)
      setPreview(question)
    } catch (e) { setError(e.message) }
  }

  const load = async () => {
    setLoading(true)
    // Paginate (Supabase caps each request at 1000) so ALL questions load.
    let all = []
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('exam_questions')
        .select('id, title, exam_type, is_active, status, external_ref, marking_criteria')
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
    return rows.filter((r) => {
      if (cat !== 'All' && r.exam_type !== cat) return false
      return matchesSearch([r.title, r.exam_type, r.pathway, r.external_ref], q)
    })
  }, [rows, q, cat])

  const openNew = () => setEditing({ form: { ...blankQuestion }, id: null })
  const openEdit = async (r) => {
    try {
      const { question } = await apiGet(`/api/admin/questions/${r.id}`)
      setEditing({ id: r.id, form: rowToForm(question || r) })
    } catch (e) {
      setError(e.message)
    }
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
    try {
      if (editing.id) await apiPut(`/api/admin/questions/${editing.id}`, payload)
      else await apiPost('/api/admin/questions', payload)
      setEditing(null)
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const setStatus = async (r, status) => {
    try {
      await apiPatch(`/api/admin/questions/${r.id}`, { status, is_active: status === 'active' })
      setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, status, is_active: status === 'active' } : x)))
    } catch (e) {
      setError(e.message)
    }
  }

  const doDelete = async () => {
    try {
      await apiDelete(`/api/admin/questions/${confirmDel.id}`)
      setConfirmDel(null)
      load()
    } catch (e) {
      setError(e.message)
      setConfirmDel(null)
    }
  }

  const [exporting, setExporting] = useState(false)
  const exportCsv = async () => {
    setExporting(true)
    try {
      const { questions } = await apiGet('/api/admin/questions/export')
      const headers = CSV_COLS.map((c) => ({ label: c, get: (r) => r[c] }))
      const csv = toCsv(questions.map(rowToCsvObj), headers)
      downloadFile(`passgp-cases-${Date.now()}.csv`, csv, 'text/csv')
    } catch (e) {
      setError(e.message)
    } finally {
      setExporting(false)
    }
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
          <Button variant="ghost" icon={<FiUpload />} onClick={() => setCsvOpen(true)}>Import CSV</Button>
          <Button variant="ghost" icon={<FiTag />} onClick={() => setAssignOpen(true)}>Upload case tags (CSV)</Button>
          <Button variant="ghost" loading={exporting} onClick={exportCsv}>Export CSV</Button>
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
                      <select
                        className={`status-pick status-pick--${r.status || (r.is_active ? 'active' : 'disabled')}`}
                        value={r.status || (r.is_active ? 'active' : 'disabled')}
                        onChange={(e) => setStatus(r, e.target.value)}
                      >
                        <option value="draft">Draft</option>
                        <option value="active">Active</option>
                        <option value="disabled">Disabled</option>
                        <option value="archived">Archived</option>
                      </select>
                    </td>
                    <td>
                      <div className="flex" style={{ justifyContent: 'flex-end', gap: 4 }}>
                        <IconButton icon={<FiPlay />} onClick={() => openPreview(r)} title="Preview & test" />
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
      {csvOpen && <CsvImportModal onClose={() => setCsvOpen(false)} onDone={load} />}
      {assignOpen && <AssignExamsModal onClose={() => setAssignOpen(false)} onDone={load} />}
      {preview && <PreviewModal q={preview} onClose={() => setPreview(null)} />}
    </>
  )
}

// Pick a value from a CSV row object by trying several header-name variants
// (case/space-insensitive), so it works with whatever Jotform exports.
function pick(obj, names) {
  const map = {}
  for (const k of Object.keys(obj)) map[k.toLowerCase().replace(/[^a-z0-9]+/g, '')] = obj[k]
  for (const n of names) { const v = map[n]; if (v != null && String(v).trim() !== '') return String(v).trim() }
  return ''
}

function AssignExamsModal({ onClose, onDone }) {
  const [rows, setRows] = useState(null) // [{case_number, college, exam_type, category}]
  const [fileName, setFileName] = useState('')
  const [err, setErr] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)

  const downloadTemplate = () => {
    const csv = 'Case Number,Exam College,Exam Type,Category\nG240,RACGP,CCE,Cardiovascular\nB510,ACRRM,STAMPS,Respiratory\n277,RANZCOG,MCQ,Obstetrics\n'
    downloadFile('passgp-case-tags-template.csv', csv, 'text/csv')
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setErr(''); setResult(null); setFileName(file.name)
    try {
      const objs = parseCsv(await file.text())
      if (!objs.length) { setErr('No rows found in that CSV.'); setRows(null); return }
      const mapped = objs.map((o) => ({
        case_number: pick(o, ['casenumber', 'case', 'caseno', 'caseid', 'number', 'formid', 'externalref', 'id']),
        college: pick(o, ['examcollege', 'college']),
        exam_type: pick(o, ['examtype', 'exam', 'type']),
        category: pick(o, ['category', 'clinicalcategory', 'specialty']),
      })).filter((r) => r.case_number && (r.college || r.exam_type || r.category))
      if (!mapped.length) { setErr('Need a "Case Number" column + at least one of Exam College / Exam Type / Category. Headers found: ' + Object.keys(objs[0]).join(', ')); setRows(null); return }
      setRows(mapped)
    } catch (e2) {
      setErr('Could not read that file: ' + e2.message)
    }
  }

  const run = async () => {
    setRunning(true); setErr('')
    try {
      let matched = 0, updated = 0, unmatched = [], examsSet = new Set()
      for (let i = 0; i < rows.length; i += 400) {
        const d = await apiPost('/api/admin/cases/tag-csv', { rows: rows.slice(i, i + 400) })
        matched += d.matched || 0; updated += d.updated || 0
        ;(d.unmatched || []).forEach((u) => unmatched.push(u))
        ;(d.exams || []).forEach((x) => examsSet.add(x))
      }
      setResult({ matched, updated, exams: [...examsSet], unmatched })
      onDone()
    } catch (e) {
      setErr(e.message)
    } finally {
      setRunning(false)
    }
  }

  return (
    <Modal
      wide
      title="Upload case tags (CSV)"
      onClose={running ? () => {} : onClose}
      footer={result ? <Button onClick={onClose}>Done</Button> : (
        <>
          <Button variant="ghost" disabled={running} onClick={onClose}>Cancel</Button>
          <Button loading={running} disabled={!rows?.length} icon={<FiTag />} onClick={run}>Tag {rows?.length || 0} case{rows?.length === 1 ? '' : 's'}</Button>
        </>
      )}
    >
      {err && <div className="alert alert--error"><FiAlertCircle /> {err}</div>}
      {result ? (
        <div>
          <div className="alert alert--success" style={{ marginBottom: 12 }}>
            <FiCheck /><div>Tagged <strong>{result.updated}</strong> case{result.updated === 1 ? '' : 's'}.{result.unmatched.length ? ` ${result.unmatched.length} row(s) didn't match.` : ''}</div>
          </div>
          {result.exams.length > 0 && <p style={{ fontSize: '0.88rem' }}>Exams updated / created: {result.exams.map((ex) => <span key={ex} className="badge badge--violet" style={{ marginRight: 6 }}>{ex}</span>)}</p>}
          {result.unmatched.length > 0 && (
            <details style={{ marginTop: 12 }}>
              <summary className="muted" style={{ cursor: 'pointer' }}>{result.unmatched.length} unmatched rows</summary>
              <div className="scrollbox" style={{ maxHeight: 160, marginTop: 8, fontSize: '0.82rem' }}>
                {result.unmatched.slice(0, 200).map((u, i) => <div key={i} style={{ padding: '3px 8px' }}>{u.case_number || '(blank)'} <span className="muted">({u.reason})</span></div>)}
              </div>
            </details>
          )}
        </div>
      ) : (
        <>
          <p className="muted" style={{ marginBottom: 10 }}>Upload a CSV that tags each case. Use exactly these four column headers:</p>
          <div className="table-wrap" style={{ marginBottom: 12 }}>
            <table className="tbl">
              <thead><tr><th>Column header</th><th>What to put</th><th>Examples</th></tr></thead>
              <tbody>
                <tr><td className="tbl__primary">Case Number</td><td>Identifies the case (its code or Jotform form ID)</td><td className="mono">G240 · B510 · 277</td></tr>
                <tr><td className="tbl__primary">Exam College</td><td>The college</td><td className="mono">RACGP · ACRRM · AMC · IME · RANZCOG · Other</td></tr>
                <tr><td className="tbl__primary">Exam Type</td><td>The exam</td><td className="mono">CCE · STAMPS · Clinical · AKT · KFP · MCQ · Other</td></tr>
                <tr><td className="tbl__primary">Category</td><td>Clinical category</td><td className="mono">Cardiovascular · Respiratory · …</td></tr>
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ fontSize: '0.84rem', marginBottom: 12 }}>
            The candidate-facing exam becomes <strong>“College + Exam Type”</strong> (e.g. <code>RACGP CCE</code>) and shows up for candidates automatically. Cases are matched by their case code / Jotform form ID.
          </p>
          <div className="flex items-center gap" style={{ flexWrap: 'wrap' }}>
            <Button size="sm" variant="ghost" icon={<FiDownloadCloud />} onClick={downloadTemplate}>Download template</Button>
            <input type="file" accept=".csv,text/csv" onChange={onFile} />
          </div>
          {fileName && rows && <p className="muted" style={{ marginTop: 10 }}>{fileName} — <strong>{rows.length}</strong> rows ready (e.g. {rows.slice(0, 2).map((r) => `${r.case_number} → ${[r.college, r.exam_type].filter(Boolean).join(' ')}`).join(', ')}…)</p>}
        </>
      )}
    </Modal>
  )
}

function PreviewModal({ q, onClose }) {
  const testUrl = `${CHATBOT_URL}/exam?caseId=${q.id}`
  const status = q.status || (q.is_active ? 'active' : 'disabled')
  const Row = ({ label, value }) => value ? (
    <div style={{ marginBottom: 12 }}>
      <div className="kv__k" style={{ marginBottom: 4 }}>{label}</div>
      <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', lineHeight: 1.55 }}>{value}</div>
    </div>
  ) : null
  return (
    <Modal
      wide
      title="Case preview & test"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button icon={<FiExternalLink />} onClick={() => window.open(testUrl, '_blank', 'noopener')}>
            Launch test session
          </Button>
        </>
      }
    >
      <div className="flex items-center gap" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: '1.15rem' }}>{q.title}</h3>
        <Badge color="violet">{q.exam_type}</Badge>
        {q.pathway && <Badge color="blue">{q.pathway}</Badge>}
        <span className={`status-pick status-pick--${status}`} style={{ pointerEvents: 'none' }}>{status}</span>
      </div>

      <div className="alert" style={{ marginBottom: 16, background: '#f8fafc' }}>
        Marks: <strong>{q.total_marks ?? 10}</strong> · Pass: <strong>{q.pass_mark ?? 5}</strong> · Time: <strong>{Math.round((q.duration_seconds || 480) / 60)} min</strong>
        {status !== 'active' && <span> · This case is <strong>{status}</strong> — you can still test it here before setting it Active.</span>}
      </div>

      <Row label="Candidate instructions" value={q.candidate_instructions} />
      <Row label="Clinical scenario / stem" value={q.stem} />
      <Row label="Patient script (examiner only)" value={q.patient_script} />
      <Row label="Marking rubric" value={(q.marking_criteria || []).map((c, i) => `${i + 1}. ${c}`).join('\n')} />
      <Row label="Model / expected answer" value={q.model_answer} />
      <Row label="Examiner instructions" value={q.examiner_instructions} />
      <Row label="Red flags" value={q.red_flags} />
      <Row label="Killer / unsafe marks (auto-fail)" value={q.killer_marks} />
    </Modal>
  )
}

function CsvImportModal({ onClose, onDone }) {
  const [parsed, setParsed] = useState(null) // array of payloads
  const [fileName, setFileName] = useState('')
  const [err, setErr] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setErr(''); setResult(null); setFileName(file.name)
    try {
      const text = await file.text()
      const objs = parseCsv(text)
      if (!objs.length) { setErr('No rows found in that CSV.'); setParsed(null); return }
      if (!('title' in objs[0]) || !('stem' in objs[0])) {
        setErr('CSV must include at least "title" and "stem" columns. Tip: export first to get the exact format.')
        setParsed(null); return
      }
      setParsed(objs.map(csvObjToPayload).filter((p) => p.title && p.stem))
    } catch (e2) {
      setErr('Could not read that file: ' + e2.message)
    }
  }

  const run = async () => {
    setRunning(true); setErr('')
    try {
      // Send in batches to stay under serverless limits.
      let inserted = 0, updated = 0, failed = 0
      for (let i = 0; i < parsed.length; i += 50) {
        const d = await apiPost('/api/admin/questions/bulk', { rows: parsed.slice(i, i + 50) })
        inserted += d.inserted || 0; updated += d.updated || 0; failed += d.failed || 0
      }
      setResult({ inserted, updated, failed, total: parsed.length })
      onDone()
    } catch (e) {
      setErr(e.message)
    } finally {
      setRunning(false)
    }
  }

  return (
    <Modal
      title="Import cases from CSV"
      onClose={running ? () => {} : onClose}
      footer={result ? <Button onClick={onClose}>Done</Button> : (
        <>
          <Button variant="ghost" disabled={running} onClick={onClose}>Cancel</Button>
          <Button loading={running} disabled={!parsed?.length} onClick={run} icon={<FiUpload />}>
            Import {parsed?.length || 0} case{parsed?.length === 1 ? '' : 's'}
          </Button>
        </>
      )}
    >
      {err && <div className="alert alert--error"><FiAlertCircle /> {err}</div>}
      {result ? (
        <div className="alert alert--success">
          <FiCheck />
          <div>Inserted <strong>{result.inserted}</strong>, updated <strong>{result.updated}</strong>{result.failed ? `, ${result.failed} skipped` : ''} of {result.total}.</div>
        </div>
      ) : (
        <>
          <p className="muted" style={{ marginBottom: 12 }}>
            Upload a CSV with columns: <code>{CSV_COLS.join(', ')}</code>. Rows are matched by <code>external_ref</code> (or title) and updated, or inserted when new. Multiple rubric items go in one cell separated by <code> | </code>. Export first to get the exact template.
          </p>
          <input type="file" accept=".csv,text/csv" onChange={onFile} />
          {fileName && parsed && <p className="muted" style={{ marginTop: 10 }}>{fileName} — <strong>{parsed.length}</strong> valid case{parsed.length === 1 ? '' : 's'} ready to import.</p>}
        </>
      )}
    </Modal>
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
          <div className="flex items-center between" style={{ margin: '10px 2px 0', flexWrap: 'wrap', gap: 8 }}>
            <label className="flex items-center gap" style={{ fontSize: '0.84rem', cursor: 'pointer' }}>
              <input type="checkbox" style={{ width: 15, height: 15, accentColor: 'var(--accent)' }}
                checked={filtered.length > 0 && filtered.every((f) => sel[f.id])}
                onChange={(e) => { const on = e.target.checked; setSel((s) => { const n = { ...s }; filtered.forEach((f) => { n[f.id] = on }); return n }) }} />
              Select all {filtered.length.toLocaleString()} matching{q.trim() ? ` "${q.trim()}"` : ''}
            </label>
            <span className="muted" style={{ fontSize: '0.8rem' }}>{selectedForms.length.toLocaleString()} selected</span>
          </div>
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
                Showing first 300 of {filtered.length.toLocaleString()} — but “Select all matching” above selects every one, then use “Import selected”.
              </div>
            )}
          </div>
        </>
      )}
    </Modal>
  )
}
