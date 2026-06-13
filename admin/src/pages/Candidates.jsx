import { useEffect, useMemo, useState } from 'react'
import { FiUsers, FiMail, FiPhone, FiGlobe, FiAward, FiMapPin } from 'react-icons/fi'
import { supabase } from '../lib/supabase'
import { Card, Badge, Search, EmptyState, PageLoader, Modal, IconButton } from '../components/ui'
import { FiEye } from 'react-icons/fi'
import { fmtDate, initials, resultBadge } from '../lib/format'

export default function Candidates() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [view, setView] = useState(null)
  const [sessions, setSessions] = useState(null)

  useEffect(() => {
    ;(async () => {
      const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
      const { data: sess } = await supabase.from('exam_sessions').select('user_id, score, created_at')
      const byUser = {}
      ;(sess || []).forEach((s) => {
        if (!s.user_id) return
        byUser[s.user_id] = byUser[s.user_id] || { count: 0, scoreSum: 0, scored: 0 }
        byUser[s.user_id].count++
        if (s.score != null) { byUser[s.user_id].scoreSum += s.score; byUser[s.user_id].scored++ }
      })
      setRows((profiles || []).map((p) => ({ ...p, stats: byUser[p.id] || { count: 0, scoreSum: 0, scored: 0 } })))
      setLoading(false)
    })()
  }, [])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return rows
    return rows.filter((r) => `${r.full_name} ${r.email} ${r.degree}`.toLowerCase().includes(term))
  }, [rows, q])

  const openProfile = async (p) => {
    setView(p)
    setSessions(null)
    const { data } = await supabase.from('exam_sessions').select('*').eq('user_id', p.id).order('created_at', { ascending: false })
    setSessions(data || [])
  }

  if (loading) return <PageLoader />

  return (
    <>
      <div className="page-head">
        <div><h2>Candidates</h2><p>{rows.length} registered candidates</p></div>
      </div>

      <div className="toolbar"><Search value={q} onChange={setQ} placeholder="Search by name, email, degree…" /></div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState icon={<FiUsers />} title="No candidates yet" text="Candidates will appear here after they sign up." />
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Candidate</th><th>Degree</th><th>Sessions</th><th>Avg score</th><th>Joined</th><th></th></tr></thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="tbl__cell-user">
                        <span className="tbl__avatar">{initials(r.full_name, r.email)}</span>
                        <div>
                          <div className="tbl__primary">{r.full_name || 'Unnamed'}</div>
                          <div className="muted" style={{ fontSize: '0.8rem' }}>{r.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>{r.degree ? <Badge color="blue">{r.degree}</Badge> : '—'}</td>
                    <td className="mono">{r.stats.count}</td>
                    <td className="mono">{r.stats.scored ? (r.stats.scoreSum / r.stats.scored / 10).toFixed(1) + '/10' : '—'}</td>
                    <td className="muted">{fmtDate(r.created_at)}</td>
                    <td style={{ textAlign: 'right' }}><IconButton icon={<FiEye />} onClick={() => openProfile(r)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {view && (
        <Modal wide title="Candidate profile" onClose={() => setView(null)}>
          <div className="flex items-center gap" style={{ marginBottom: 6 }}>
            <span className="tbl__avatar" style={{ width: 54, height: 54, fontSize: '1.1rem' }}>{initials(view.full_name, view.email)}</span>
            <div>
              <h3 style={{ fontSize: '1.2rem' }}>{view.full_name || 'Unnamed candidate'}</h3>
              <p className="muted">{view.email}</p>
            </div>
          </div>
          <div className="grid grid-2" style={{ gap: 12 }}>
            <Info icon={<FiMail />} label="Email" value={view.email} />
            <Info icon={<FiPhone />} label="Phone" value={view.phone} />
            <Info icon={<FiGlobe />} label="Language" value={view.language} />
            <Info icon={<FiAward />} label="Degree" value={view.degree} />
            <Info icon={<FiMapPin />} label="Address" value={view.address} />
            <Info icon={<FiUsers />} label="Father's name" value={view.father_name} />
          </div>
          <div className="divider" />
          <h4 style={{ fontSize: '0.95rem', marginBottom: 8 }}>Exam history</h4>
          {sessions === null ? (
            <div className="loader-dots"><span /><span /><span /></div>
          ) : sessions.length === 0 ? (
            <p className="muted">No exam sessions yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Exam</th><th>Score</th><th>Result</th><th>Date</th></tr></thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id}>
                      <td>{s.exam_type}</td>
                      <td className="mono">{s.score != null ? Math.round(s.score / 10) + '/10' : '—'}</td>
                      <td>{s.result ? <Badge color={resultBadge(s.result)}>{s.result}</Badge> : '—'}</td>
                      <td className="muted">{fmtDate(s.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </>
  )
}

function Info({ icon, label, value }) {
  return (
    <div className="flex gap" style={{ alignItems: 'flex-start' }}>
      <span style={{ color: 'var(--accent)', marginTop: 2 }}>{icon}</span>
      <div className="kv"><span className="kv__k">{label}</span><span className="kv__v">{value || '—'}</span></div>
    </div>
  )
}
