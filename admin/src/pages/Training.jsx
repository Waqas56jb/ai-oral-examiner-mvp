import { useEffect, useMemo, useState } from 'react'
import {
  FiPlus, FiEdit2, FiTrash2, FiEye, FiChevronRight, FiChevronLeft, FiLayers, FiCheck, FiAlertCircle,
} from 'react-icons/fi'
import { supabase } from '../lib/supabase'
import { apiGet, apiPost, apiPut, apiDelete } from '../lib/api'
import { Card, Button, IconButton, Badge, Search, EmptyState, PageLoader, Modal } from '../components/ui'
import QuestionForm, { rowToForm, formToPayload, blankQuestion, PATHWAYS } from '../components/QuestionForm'
import { matchesSearch } from '../lib/search'

export default function Training() {
  const [docs, setDocs] = useState(null)
  const [cat, setCat] = useState('All')
  const [pathway, setPathway] = useState('All exams')
  const [qA, setQA] = useState('')
  const [qT, setQT] = useState('')
  const [sel, setSel] = useState({})
  const [busy, setBusy] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [editing, setEditing] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [assignExam, setAssignExam] = useState('')
  const [bulkDel, setBulkDel] = useState(false)
  const [error, setError] = useState('')

  // Direct Supabase fetch (paginated) — used as a fallback if the backend
  // endpoint isn't deployed yet.
  const loadDirect = async () => {
    let all = []
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('exam_questions')
        .select('id, title, exam_type, pathway, in_training, is_active')
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

  // Exam pathways present in the bank — lets the admin "train specific exams"
  // (e.g. RACGP CCE vs StAMPS) rather than just clinical categories.
  const pathways = useMemo(() => {
    const s = new Set()
    ;(docs || []).forEach((d) => d.pathway && s.add(d.pathway))
    return ['All exams', ...Array.from(s).sort()]
  }, [docs])

  const inCat = (d) => cat === 'All' || d.exam_type === cat
  const inPathway = (d) => pathway === 'All exams' || (d.pathway || '') === pathway
  // Smart search across title, clinical category and exam — case/space/synonym
  // aware (e.g. "stamps" finds ACRRM cases, "cce" finds RACGP).
  const matches = (d, term) => matchesSearch([d.title, d.exam_type, d.pathway], term)
  const available = useMemo(
    () => (docs || []).filter((d) => !d.in_training && inCat(d) && inPathway(d) && matches(d, qA)),
    [docs, cat, pathway, qA] // eslint-disable-line
  )
  const training = useMemo(
    () => (docs || []).filter((d) => d.in_training && inCat(d) && inPathway(d) && matches(d, qT)),
    [docs, cat, pathway, qT] // eslint-disable-line
  )
  // When the Available search finds nothing, surface matching cases that are
  // ALREADY in the training set (so a "stamps" search still shows them).
  const trainedMatches = useMemo(
    () => (qA.trim() ? (docs || []).filter((d) => d.in_training && matches(d, qA)) : []),
    [docs, qA] // eslint-disable-line
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

  // Bulk-assign selected cases to an exam (sets their pathway), so they appear
  // under that exam in Exam Profiles and the candidate picker.
  const assignToExam = async (ids, exam) => {
    if (!ids.length || !exam) return
    setBusy(true); setError('')
    try {
      await apiPost('/api/admin/questions/bulk-update', { ids, patch: { pathway: exam } })
      setDocs((ds) => ds.map((d) => (ids.includes(d.id) ? { ...d, pathway: exam } : d)))
      setSel({})
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  // Bulk delete selected cases.
  const deleteMany = async (ids) => {
    if (!ids.length) return
    setBusy(true); setError('')
    try {
      await apiPost('/api/admin/questions/bulk-delete', { ids })
      setDocs((ds) => ds.filter((d) => !ids.includes(d.id)))
      setSel({})
      setBulkDel(false)
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

      <div className="toolbar" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div className="flex items-center gap">
          <span className="muted" style={{ fontSize: '0.82rem', fontWeight: 600 }}>Exam:</span>
          <select className="select" style={{ minWidth: 200 }} value={pathway} onChange={(e) => setPathway(e.target.value)}>
            {pathways.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="flex gap" style={{ flexWrap: 'wrap' }}>
          {cats.map((c) => <button key={c} className={`chip ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>{c}</button>)}
        </div>
      </div>
      {pathway !== 'All exams' && (
        <p className="muted" style={{ fontSize: '0.82rem', margin: '-6px 0 12px' }}>
          Showing only <strong>{pathway}</strong> cases. Use “Push all” to train the examiner on this entire exam.
        </p>
      )}

      {error && <div className="alert alert--error" style={{ marginBottom: 14 }}><FiAlertCircle /> {error}</div>}

      <div className="train-grid">
        {/* Available */}
        <div className="train-col">
          <div className="train-col__head">
            <div className="train-col__title"><FiLayers /> Available Documents <span className="train-col__count">{available.length}</span></div>
            <div style={{ marginTop: 10 }}><Search value={qA} onChange={setQA} placeholder="Search title, category or exam…" /></div>
            {available.length > 0 && (
              <label className="flex items-center gap" style={{ marginTop: 10, fontSize: '0.82rem', cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: 15, height: 15, accentColor: 'var(--accent)' }}
                  checked={available.length > 0 && available.every((d) => sel[d.id])}
                  onChange={(e) => { const on = e.target.checked; setSel((s) => { const n = { ...s }; available.forEach((d) => { n[d.id] = on }); return n }) }} />
                Select all {available.length} matching
              </label>
            )}
          </div>
          <div className="train-list">
            {available.length === 0 ? (
              trainedMatches.length > 0 ? (
                <div>
                  <div className="train-empty" style={{ paddingBottom: 8 }}>
                    No <em>untrained</em> cases match “{qA}”. {trainedMatches.length} matching case{trainedMatches.length === 1 ? ' is' : 's are'} already in your Training Set →
                  </div>
                  {trainedMatches.slice(0, 100).map((d) => (
                    <div key={d.id} className="train-row" style={{ opacity: 0.92 }}>
                      <Badge color="green">In training</Badge>
                      <span className="train-row__title">{d.title}</span>
                      <Badge color="violet">{d.exam_type}</Badge>
                      {d.pathway && <Badge color="blue">{d.pathway}</Badge>}
                      <IconButton icon={<FiEye />} onClick={() => view(d)} title="View" />
                      <Button size="sm" variant="ghost" onClick={() => setTraining([d.id], false)} icon={<FiChevronLeft />}>Remove</Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="train-empty">
                  {qA.trim()
                    ? <>No cases match “{qA}”.<br /><span style={{ fontSize: '0.82rem' }}>Try a case code (e.g. <strong>D11</strong>, <strong>B51</strong>, <strong>G24</strong>), a category, or an exam (<strong>CCE</strong>, <strong>StAMPS</strong>, <strong>KFP</strong>).</span></>
                    : 'No available documents in this category.'}
                </div>
              )
            ) : (
              available.slice(0, 500).map((d) => (
                <div key={d.id} className="train-row">
                  <input type="checkbox" checked={!!sel[d.id]} onChange={() => setSel((s) => ({ ...s, [d.id]: !s[d.id] }))} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
                  <span className="train-row__title">{d.title}</span>
                  <Badge color="violet">{d.exam_type}</Badge>
                  {d.pathway && <Badge color="blue">{d.pathway}</Badge>}
                  <IconButton icon={<FiEye />} onClick={() => view(d)} title="View" />
                  <IconButton icon={<FiEdit2 />} onClick={() => openEdit(d)} title="Edit" />
                  <IconButton icon={<FiTrash2 />} danger onClick={() => setConfirmDel(d)} title="Delete" />
                  <Button size="sm" variant="soft" onClick={() => setTraining([d.id], true)} icon={<FiChevronRight />}>Push</Button>
                </div>
              ))
            )}
            {available.length > 500 && <div className="train-empty">Showing first 500 of {available.length}. Refine with search/category, or use “Select all matching” + a bulk action below.</div>}
          </div>
          {/* Bulk action bar */}
          <div className="train-bulkbar">
            <span className="muted" style={{ fontSize: '0.8rem' }}>{selIds.length} selected</span>
            <select className="select" style={{ maxWidth: 180 }} value={assignExam} onChange={(e) => setAssignExam(e.target.value)}>
              <option value="">Assign to exam…</option>
              {PATHWAYS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <Button size="sm" variant="ghost" disabled={busy || !selIds.length || !assignExam} onClick={() => assignToExam(selIds, assignExam)}>Assign</Button>
            <Button size="sm" variant="danger" disabled={busy || !selIds.length} icon={<FiTrash2 />} onClick={() => setBulkDel(true)}>Delete</Button>
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
              training.slice(0, 500).map((d) => (
                <div key={d.id} className="train-row">
                  <Button size="sm" variant="ghost" onClick={() => setTraining([d.id], false)} icon={<FiChevronLeft />}>Remove</Button>
                  <span className="train-row__title">{d.title}</span>
                  <Badge color="violet">{d.exam_type}</Badge>
                  {d.pathway && <Badge color="blue">{d.pathway}</Badge>}
                  <IconButton icon={<FiEye />} onClick={() => view(d)} title="View" />
                  <IconButton icon={<FiEdit2 />} onClick={() => openEdit(d)} title="Edit" />
                </div>
              ))
            )}
            {training.length > 500 && <div className="train-empty">Showing first 500 of {training.length}.</div>}
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

      {bulkDel && (
        <Modal title={`Delete ${selIds.length} cases?`} onClose={() => setBulkDel(false)}
          footer={<><Button variant="ghost" onClick={() => setBulkDel(false)}>Cancel</Button><Button variant="danger" loading={busy} icon={<FiTrash2 />} onClick={() => deleteMany(selIds)}>Delete {selIds.length} permanently</Button></>}>
          <p>You are about to permanently delete <strong>{selIds.length}</strong> selected case{selIds.length === 1 ? '' : 's'}. This cannot be undone.</p>
        </Modal>
      )}
    </>
  )
}
