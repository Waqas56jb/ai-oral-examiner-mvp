import { useEffect, useMemo, useState } from 'react'
import { FiClipboard, FiEye, FiCheckCircle, FiAlertTriangle, FiDownload } from 'react-icons/fi'
import { supabase } from '../lib/supabase'
import { Card, Badge, Search, EmptyState, PageLoader, Modal, IconButton, Button } from '../components/ui'
import { fmtDateTime, fmtDuration, resultBadge, downloadFile } from '../lib/format'

export default function Sessions() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [view, setView] = useState(null)
  const [turns, setTurns] = useState(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('exam_sessions').select('*').order('created_at', { ascending: false }).limit(500)
    setRows(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (status !== 'all' && r.status !== status) return false
      if (!term) return true
      return `${r.exam_type} ${r.result} ${r.summary}`.toLowerCase().includes(term)
    })
  }, [rows, q, status])

  const open = async (s) => {
    setView(s)
    setTurns(null)
    const { data } = await supabase.from('session_turns').select('*').eq('session_id', s.id).order('id', { ascending: true })
    setTurns(data || [])
  }

  if (loading) return <PageLoader />

  return (
    <>
      <div className="page-head">
        <div><h2>Exam Sessions</h2><p>{rows.length} sessions · {rows.filter((r) => r.status === 'completed').length} completed</p></div>
      </div>

      <div className="toolbar">
        <Search value={q} onChange={setQ} placeholder="Search sessions…" />
        <div className="flex gap">
          {['all', 'completed', 'in_progress'].map((s) => (
            <button key={s} className={`chip ${status === s ? 'active' : ''}`} onClick={() => setStatus(s)}>{s === 'all' ? 'All' : s.replace('_', ' ')}</button>
          ))}
        </div>
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState icon={<FiClipboard />} title="No sessions" text="Completed AI exam sessions will appear here." />
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Exam</th><th>Score</th><th>Result</th><th>Duration</th><th>Status</th><th>When</th><th></th></tr></thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="tbl__primary">{r.exam_type || '—'}</td>
                    <td className="mono">{r.score != null ? Math.round(r.score / 10) + '/10' : '—'}</td>
                    <td>{r.result ? <Badge color={resultBadge(r.result)}>{r.result}</Badge> : '—'}</td>
                    <td className="mono">{fmtDuration(r.duration_sec)}</td>
                    <td><Badge color={r.status === 'completed' ? 'green' : 'amber'} dot>{r.status}</Badge></td>
                    <td className="muted">{fmtDateTime(r.created_at)}</td>
                    <td style={{ textAlign: 'right' }}><IconButton icon={<FiEye />} onClick={() => open(r)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {view && (
        <Modal wide title="Session review" onClose={() => setView(null)}>
          <div className="flex between items-center">
            <div>
              <h3 style={{ fontSize: '1.15rem' }}>{view.exam_type} session</h3>
              <p className="muted">{fmtDateTime(view.created_at)} · {fmtDuration(view.duration_sec)}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--head)', fontWeight: 800, fontSize: '1.8rem', color: 'var(--ink)' }}>
                {view.score != null ? Math.round(view.score / 10) : '—'}<span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>/10</span>
              </div>
              {view.result && <Badge color={resultBadge(view.result)}>{view.result}</Badge>}
            </div>
          </div>

          {view.summary && (
            <div className="card" style={{ background: '#f8fafc' }}>
              <div className="card__body">
                <div className="kv__k" style={{ marginBottom: 6 }}>AI examiner feedback</div>
                <p style={{ lineHeight: 1.7 }}>{view.summary}</p>
              </div>
            </div>
          )}

          <div className="grid grid-2" style={{ gap: 14 }}>
            <FbList title="Strengths" items={view.strengths} icon={<FiCheckCircle />} color="#16a34a" />
            <FbList title="Areas to improve" items={view.improvements} icon={<FiAlertTriangle />} color="#d97706" />
          </div>

          <div className="divider" />
          <div className="flex between items-center">
            <h4 style={{ fontSize: '0.95rem' }}>Transcript</h4>
            {turns?.length > 0 && (
              <Button size="sm" variant="ghost" icon={<FiDownload />} onClick={() => downloadTranscript(view, turns)}>Download</Button>
            )}
          </div>
          {turns === null ? (
            <div className="loader-dots"><span /><span /><span /></div>
          ) : turns.length === 0 ? (
            <p className="muted">No transcript recorded.</p>
          ) : (
            <div className="scrollbox" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {turns.map((t) => (
                <div key={t.id} style={{ padding: '10px 14px', borderRadius: 12, background: t.role === 'examiner' ? '#f6f9ff' : '#f3fbf9', border: '1px solid var(--line-2)' }}>
                  <div className="flex between" style={{ marginBottom: 4 }}>
                    <span style={{ fontWeight: 800, fontSize: '0.7rem', letterSpacing: '0.06em', color: t.role === 'examiner' ? 'var(--accent)' : '#0d9488' }}>{t.role.toUpperCase()}</span>
                    <span className="muted" style={{ fontSize: '0.72rem' }}>{t.time_marker}</span>
                  </div>
                  <p style={{ fontSize: '0.9rem' }}>{t.text}</p>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </>
  )
}

function FbList({ title, items, icon, color }) {
  const list = Array.isArray(items) ? items : []
  return (
    <div>
      <div className="kv__k" style={{ marginBottom: 8 }}>{title}</div>
      {list.length === 0 ? <p className="muted" style={{ fontSize: '0.85rem' }}>None recorded.</p> : (
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {list.map((it, i) => (
            <li key={i} className="flex gap" style={{ alignItems: 'flex-start', fontSize: '0.88rem' }}>
              <span style={{ color, marginTop: 2, flexShrink: 0 }}>{icon}</span>{it}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function downloadTranscript(session, turns) {
  const lines = [
    `PassGP Session Transcript`,
    `Exam: ${session.exam_type}`,
    `Date: ${fmtDateTime(session.created_at)}`,
    `Score: ${session.score != null ? Math.round(session.score / 10) + '/10' : 'n/a'} (${session.result || ''})`,
    '─'.repeat(50),
    '',
    ...turns.map((t) => `[${t.time_marker || ''}] ${t.role.toUpperCase()}: ${t.text}`),
  ]
  downloadFile(`transcript-${session.id}.txt`, lines.join('\n'))
}
