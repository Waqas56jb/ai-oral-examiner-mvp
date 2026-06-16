import { useEffect, useMemo, useState } from 'react'
import { FiUsers, FiMail, FiEye, FiDownload, FiTrendingUp } from 'react-icons/fi'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { supabase } from '../lib/supabase'
import { Card, Badge, Search, EmptyState, PageLoader, Modal, IconButton, Button } from '../components/ui'
import { fmtDate, fmtDateTime, initials, resultBadge, toCsv, downloadFile } from '../lib/format'

// A "candidate" is now derived from session registration (no candidate logins).
// We group sessions by email (falling back to name) to build each candidate's history.
function keyFor(s) {
  return (s.candidate_email && s.candidate_email.trim().toLowerCase()) || (s.candidate_name && s.candidate_name.trim().toLowerCase()) || null
}

export default function Candidates() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [view, setView] = useState(null)

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase
        .from('exam_sessions')
        .select('id, candidate_name, candidate_email, pathway, exam_type, score, score_override, pass_fail, result, strengths, improvements, missed_items, unsafe_areas, created_at')
        .order('created_at', { ascending: false })
        .limit(2000)
      setSessions(data || [])
      setLoading(false)
    })()
  }, [])

  // Aggregate sessions into candidate records.
  const candidates = useMemo(() => {
    const map = new Map()
    for (const s of sessions) {
      const k = keyFor(s)
      if (!k) continue
      if (!map.has(k)) map.set(k, { key: k, name: s.candidate_name || '', email: s.candidate_email || '', pathway: s.pathway || '', items: [] })
      const c = map.get(k)
      if (!c.name && s.candidate_name) c.name = s.candidate_name
      if (!c.email && s.candidate_email) c.email = s.candidate_email
      if (!c.pathway && s.pathway) c.pathway = s.pathway
      c.items.push(s)
    }
    return [...map.values()].map((c) => {
      const scored = c.items.filter((s) => (s.score_override ?? s.score) != null)
      const avg = scored.length ? scored.reduce((a, s) => a + (s.score_override ?? s.score), 0) / scored.length / 10 : null
      const passes = c.items.filter((s) => (s.pass_fail ? !/fail/i.test(s.pass_fail) : (s.score_override ?? s.score) != null ? (s.score_override ?? s.score) >= 50 : false)).length
      return {
        ...c,
        attempts: c.items.length,
        avg,
        passRate: c.items.length ? Math.round((passes / c.items.length) * 100) : 0,
        last: c.items[0]?.created_at,
      }
    }).sort((a, b) => new Date(b.last) - new Date(a.last))
  }, [sessions])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return candidates
    return candidates.filter((c) => `${c.name} ${c.email} ${c.pathway}`.toLowerCase().includes(term))
  }, [candidates, q])

  const exportCsv = () => {
    const csv = toCsv(candidates, [
      { label: 'Candidate', get: (c) => c.name || 'Anonymous' },
      { label: 'Email', key: 'email' },
      { label: 'Pathway', key: 'pathway' },
      { label: 'Attempts', key: 'attempts' },
      { label: 'Avg score /10', get: (c) => (c.avg != null ? c.avg.toFixed(1) : '') },
      { label: 'Pass rate %', key: 'passRate' },
      { label: 'Last attempt', get: (c) => fmtDateTime(c.last) },
    ])
    downloadFile(`passgp-candidates-${Date.now()}.csv`, csv, 'text/csv')
  }

  if (loading) return <PageLoader />

  return (
    <>
      <div className="page-head">
        <div><h2>Candidates</h2><p>{candidates.length} candidates · {sessions.length} sessions</p></div>
        <div className="page-actions"><Button variant="ghost" icon={<FiDownload />} onClick={exportCsv}>Export CSV</Button></div>
      </div>

      <div className="toolbar"><Search value={q} onChange={setQ} placeholder="Search by name, email, pathway…" /></div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState icon={<FiUsers />} title="No candidates yet" text="Candidates appear here after they register and take an exam." />
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Candidate</th><th>Pathway</th><th>Attempts</th><th>Avg score</th><th>Pass rate</th><th>Last attempt</th><th></th></tr></thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.key}>
                    <td>
                      <div className="tbl__cell-user">
                        <span className="tbl__avatar">{initials(c.name, c.email)}</span>
                        <div>
                          <div className="tbl__primary">{c.name || 'Anonymous'}</div>
                          <div className="muted" style={{ fontSize: '0.8rem' }}>{c.email || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td>{c.pathway ? <Badge color="blue">{c.pathway}</Badge> : '—'}</td>
                    <td className="mono">{c.attempts}</td>
                    <td className="mono">{c.avg != null ? c.avg.toFixed(1) + '/10' : '—'}</td>
                    <td className="mono">{c.passRate}%</td>
                    <td className="muted">{fmtDate(c.last)}</td>
                    <td style={{ textAlign: 'right' }}><IconButton icon={<FiEye />} onClick={() => setView(c)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {view && <CandidateModal c={view} onClose={() => setView(null)} />}
    </>
  )
}

function CandidateModal({ c, onClose }) {
  // Chronological trend (oldest → newest)
  const chron = [...c.items].slice().reverse()
  const trend = chron.map((s, i) => ({ label: `#${i + 1}`, score: (s.score_override ?? s.score) != null ? Math.round((s.score_override ?? s.score) / 10 * 10) / 10 : null }))
                     .filter((p) => p.score != null)
  const latest = c.items[0]
  return (
    <Modal wide title="Candidate dashboard" onClose={onClose}>
      <div className="flex items-center gap" style={{ marginBottom: 12 }}>
        <span className="tbl__avatar" style={{ width: 54, height: 54, fontSize: '1.1rem' }}>{initials(c.name, c.email)}</span>
        <div>
          <h3 style={{ fontSize: '1.2rem' }}>{c.name || 'Anonymous candidate'}</h3>
          <p className="muted">{c.email || 'No email'}{c.pathway ? ` · ${c.pathway}` : ''}</p>
        </div>
      </div>

      <div className="grid grid-3" style={{ gap: 12, marginBottom: 16 }}>
        <MiniStat label="Attempts" value={c.attempts} />
        <MiniStat label="Average score" value={c.avg != null ? c.avg.toFixed(1) + '/10' : '—'} />
        <MiniStat label="Pass rate" value={c.passRate + '%'} />
      </div>

      {trend.length > 1 && (
        <Card title={<span><FiTrendingUp style={{ verticalAlign: '-2px' }} /> Progression</span>} sub="Score per attempt (/10)" style={{ marginBottom: 16 }}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trend} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e8ecf3', fontSize: 13 }} />
              <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      <h4 style={{ fontSize: '0.95rem', marginBottom: 8 }}>Attempt history</h4>
      <div className="table-wrap" style={{ marginBottom: 16 }}>
        <table className="tbl">
          <thead><tr><th>Exam</th><th>Score</th><th>Result</th><th>Date</th></tr></thead>
          <tbody>
            {c.items.map((s) => (
              <tr key={s.id}>
                <td>{s.exam_type || '—'}</td>
                <td className="mono">{(s.score_override ?? s.score) != null ? Math.round((s.score_override ?? s.score) / 10) + '/10' : '—'}</td>
                <td>{s.pass_fail ? <Badge color={/fail/i.test(s.pass_fail) ? 'red' : 'green'}>{s.pass_fail}</Badge> : s.result ? <Badge color={resultBadge(s.result)}>{s.result}</Badge> : '—'}</td>
                <td className="muted">{fmtDate(s.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {latest && (Array.isArray(latest.improvements) && latest.improvements.length > 0) && (
        <div>
          <h4 style={{ fontSize: '0.95rem', marginBottom: 8 }}>Latest feedback — areas to improve</h4>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {latest.improvements.map((it, i) => <li key={i} style={{ fontSize: '0.88rem' }}>• {it}</li>)}
          </ul>
        </div>
      )}
    </Modal>
  )
}

function MiniStat({ label, value }) {
  return (
    <div className="card" style={{ background: '#f8fafc' }}>
      <div className="card__body" style={{ textAlign: 'center', padding: '14px 10px' }}>
        <div style={{ fontFamily: 'var(--head)', fontWeight: 800, fontSize: '1.5rem', color: 'var(--ink)' }}>{value}</div>
        <div className="kv__k">{label}</div>
      </div>
    </div>
  )
}
