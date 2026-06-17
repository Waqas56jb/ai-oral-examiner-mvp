import { useEffect, useMemo, useState } from 'react'
import {
  FiPlus, FiEdit2, FiTrash2, FiEye, FiChevronRight, FiChevronLeft, FiLayers, FiCheck, FiAlertCircle,
} from 'react-icons/fi'
import { supabase } from '../lib/supabase'
import { apiGet, apiPost, apiPut, apiDelete } from '../lib/api'
import { Card, Button, IconButton, Badge, Search, EmptyState, PageLoader, Modal } from '../components/ui'
import QuestionForm, { rowToForm, formToPayload, blankQuestion } from '../components/QuestionForm'

export default function Training() {
  const [docs, setDocs] = useState(null)
  const [cat, setCat] = useState('All')
  const [qA, setQA] = useState('')
  const [qT, setQT] = useState('')
  const [sel, setSel] = useState({})
  const [busy, setBusy] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [editing, setEditing] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [error, setError] = useState('')

  // Direct Supabase fetch (paginated) — used as a fallback if the backend
  // endpoint isn't deployed yet.
  const loadDirect = async () => {
    let all = []
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('exam_questions')
        .select('id, title, exam_type, in_training, is_active')
        .order('title')
        .range(from, from + 999)
      if (error) throw error
      all = all.concat(data || [])
      if (!data || data.length < 1000) break
      from += 1000
    }
    return all
  }

  const load = async () => {
    try {
      const d = await apiGet('/api/admin/questions') // backend (service key)
      setDocs(d.questions || [])
    } catch {
      try {
        setDocs(await loadDirect()) // fallback: direct Supabase (returns all rows)
      } catch (e) {
        setError(e.message)
        setDocs([])
      }
    }
  }
  useEffect(() => { load() }, [])

  const cats = useMemo(() => {
    const s = new Set()
    ;(docs || []).forEach((d) => d.exam_type && s.add(d.exam_type))
    return ['All', ...Array.from(s).sort()]
  }, [docs])

  const inCat = (d) => cat === 'All' || d.exam_type === cat
  const available = useMemo(
    () => (docs || []).filter((d) => !d.in_training && inCat(d) && (!qA.trim() || d.title.toLowerCase().includes(qA.toLowerCase()))),
    [docs, cat, qA] // eslint-disable-line
  )
  const training = useMemo(
    () => (docs || []).filter((d) => d.in_training && inCat(d) && (!qT.trim() || d.title.toLowerCase().includes(qT.toLowerCase()))),
    [docs, cat, qT] // eslint-disable-line
  )
  const selIds = Object.keys(sel).filter((k) => sel[k])

  const setTraining = async (ids, value) => {
    if (!ids.length) return
    setBusy(true); setError('')
    try {
      // Writes go through the protected backend (service key) — anon writes are
      // blocked by RLS for security.
      await apiPost('/api/admin/training/set', { ids, in_training: value })
      setDocs((ds) => ds.map((d) => (ids.includes(d.id) ? { ...d, in_training: value } : d)))
      setSel({})
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const fetchFull = async (id) => (await apiGet(`/api/admin/questions/${id}`)).question

  const view = async (d) => setViewing((await fetchFull(d.id)) || d)
  const openEdit = async (d) => {
    const data = await fetchFull(d.id)
    setEditing({ id: d.id, form: rowToForm(data) })
  }
  const openAdd = () => setEditing({ id: null, form: { ...blankQuestion } })

  const saveDoc = async () => {
    const f = editing.form
    if (!f.title.trim() || !f.stem.trim()) { setError('Title and scenario are required.'); return }
    setBusy(true); setError('')
    const payload = formToPayload(f)
    try {
      if (editing.id) await apiPut(`/api/admin/questions/${editing.id}`, payload)
      else await apiPost('/api/admin/questions', { ...payload, in_training: true })
      setEditing(null); load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const doDelete = async () => {
    try { await apiDelete(`/api/admin/questions/${confirmDel.id}`) } catch (e) { setError(e.message) }
    setConfirmDel(null); load()
  }

  if (docs === null) return <PageLoader />

  return (
    <>
      <div className="page-head">
        <div><h2>Training Panel</h2><p>Curate exactly which documents the AI examiner trains on</p></div>
        <div className="page-actions"><Button icon={<FiPlus />} onClick={openAdd}>Add document</Button></div>
      </div>

      <div className="toolbar">
        <div className="flex gap" style={{ flexWrap: 'wrap' }}>
          {cats.map((c) => <button key={c} className={`chip ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>{c}</button>)}
        </div>
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: 14 }}><FiAlertCircle /> {error}</div>}

      <div className="train-grid">
        {/* Available */}
        <div className="train-col">
          <div className="train-col__head">
            <div className="train-col__title"><FiLayers /> Available Documents <span className="train-col__count">{available.length}</span></div>
            <div style={{ marginTop: 10 }}><Search value={qA} onChange={setQA} placeholder="Search available…" /></div>
          </div>
          <div className="train-list">
            {available.length === 0 ? (
              <div className="train-empty">No available documents in this category.</div>
            ) : (
              available.slice(0, 300).map((d) => (
                <div key={d.id} className="train-row">
                  <input type="checkbox" checked={!!sel[d.id]} onChange={() => setSel((s) => ({ ...s, [d.id]: !s[d.id] }))} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
                  <span className="train-row__title">{d.title}</span>
                  <Badge color="violet">{d.exam_type}</Badge>
                  <IconButton icon={<FiEye />} onClick={() => view(d)} title="View" />
                  <IconButton icon={<FiEdit2 />} onClick={() => openEdit(d)} title="Edit" />
                  <IconButton icon={<FiTrash2 />} danger onClick={() => setConfirmDel(d)} title="Delete" />
                  <Button size="sm" variant="soft" onClick={() => setTraining([d.id], true)} icon={<FiChevronRight />}>Push</Button>
                </div>
              ))
            )}
            {available.length > 300 && <div className="train-empty">Showing 300 of {available.length}. Use search or category.</div>}
          </div>
          <div className="train-col__foot">
            <Button variant="ghost" size="sm" disabled={busy || available.length === 0} onClick={() => setTraining(available.map((d) => d.id), true)}>Push all ({available.length})</Button>
            <Button size="sm" loading={busy} disabled={selIds.length === 0} icon={<FiChevronRight />} onClick={() => setTraining(selIds, true)}>Push selected ({selIds.length})</Button>
          </div>
        </div>

        {/* Training set */}
        <div className="train-col train-col--active">
          <div className="train-col__head">
            <div className="train-col__title"><FiCheck /> Training Set <span className="train-col__count is-active">{training.length}</span></div>
            <div style={{ marginTop: 10 }}><Search value={qT} onChange={setQT} placeholder="Search training set…" /></div>
          </div>
          <div className="train-list">
            {training.length === 0 ? (
              <div className="train-empty">No documents in the training set yet.<br />Push some from the left — the examiner will use only these.</div>
            ) : (
              training.slice(0, 300).map((d) => (
                <div key={d.id} className="train-row">
                  <Button size="sm" variant="ghost" onClick={() => setTraining([d.id], false)} icon={<FiChevronLeft />}>Remove</Button>
                  <span className="train-row__title">{d.title}</span>
                  <Badge color="violet">{d.exam_type}</Badge>
                  <IconButton icon={<FiEye />} onClick={() => view(d)} title="View" />
                  <IconButton icon={<FiEdit2 />} onClick={() => openEdit(d)} title="Edit" />
                </div>
              ))
            )}
            {training.length > 300 && <div className="train-empty">Showing 300 of {training.length}.</div>}
          </div>
          <div className="train-col__foot">
            <span className="muted" style={{ fontSize: '0.82rem' }}>🎯 The examiner trains on these.</span>
            <Button variant="ghost" size="sm" disabled={busy || training.length === 0} onClick={() => setTraining(training.map((d) => d.id), false)}>Remove all</Button>
          </div>
        </div>
      </div>

      {/* View */}
      {viewing && (
        <Modal wide title={viewing.title} onClose={() => setViewing(null)} footer={<Button onClick={() => setViewing(null)}>Close</Button>}>
          <div className="flex gap" style={{ flexWrap: 'wrap' }}>
            <Badge color="violet">{viewing.exam_type}</Badge>
            {viewing.in_training && <Badge color="green" dot>In training</Badge>}
          </div>
          <div className="kv"><span className="kv__k">Clinical scenario</span><p style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{viewing.stem}</p></div>
          {(viewing.marking_criteria || []).length > 0 && (
            <div className="kv"><span className="kv__k">Tasks / questions</span><ul style={{ paddingLeft: 18, lineHeight: 1.8 }}>{viewing.marking_criteria.map((q, i) => <li key={i}>{q}</li>)}</ul></div>
          )}
          {viewing.model_answer && (
            <div className="kv"><span className="kv__k">Model answer (examiner only)</span><p style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--muted)' }}>{viewing.model_answer}</p></div>
          )}
        </Modal>
      )}

      {/* Edit / Add */}
      {editing && (
        <Modal wide title={editing.id ? 'Edit document' : 'New document'} onClose={() => { setEditing(null); setError('') }}
          footer={<><Button variant="ghost" onClick={() => { setEditing(null); setError('') }}>Cancel</Button><Button loading={busy} icon={<FiCheck />} onClick={saveDoc}>Save</Button></>}>
          {error && <div className="alert alert--error"><FiAlertCircle /> {error}</div>}
          <QuestionForm
            form={editing.form}
            set={(k, v) => setEditing((s) => ({ ...s, form: { ...s.form, [k]: v } }))}
            categories={cats.filter((c) => c !== 'All')}
          />
        </Modal>
      )}

      {/* Delete */}
      {confirmDel && (
        <Modal title="Delete document?" onClose={() => setConfirmDel(null)}
          footer={<><Button variant="ghost" onClick={() => setConfirmDel(null)}>Cancel</Button><Button variant="danger" icon={<FiTrash2 />} onClick={doDelete}>Delete</Button></>}>
          <p>Delete <strong>{confirmDel.title}</strong>? This cannot be undone.</p>
        </Modal>
      )}
    </>
  )
}
