import { useEffect, useMemo, useState } from 'react'
import { FiFileText, FiEye, FiDownload, FiMessageSquare } from 'react-icons/fi'
import { supabase } from '../lib/supabase'
import { Card, Search, EmptyState, PageLoader, Modal, IconButton, Button, Badge } from '../components/ui'
import { fmtDateTime, downloadFile, resultBadge } from '../lib/format'

export default function Transcripts() {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [view, setView] = useState(null)

  useEffect(() => {
    ;(async () => {
      const [{ data: sessions }, { data: turns }] = await Promise.all([
        supabase.from('exam_sessions').select('id, exam_type, result, score, created_at').order('created_at', { ascending: false }).limit(500),
        supabase.from('session_turns').select('session_id, role, text, time_marker, id').order('id', { ascending: true }).limit(5000),
      ])
      const byS = {}
      ;(turns || []).forEach((t) => { (byS[t.session_id] = byS[t.session_id] || []).push(t) })
      const list = (sessions || [])
        .map((s) => ({ ...s, turns: byS[s.id] || [] }))
        .filter((s) => s.turns.length > 0)
      setGroups(list)
      setLoading(false)
    })()
  }, [])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return groups
    return groups.filter((g) => `${g.exam_type} ${g.turns.map((t) => t.text).join(' ')}`.toLowerCase().includes(term))
  }, [groups, q])

  if (loading) return <PageLoader />

  return (
    <>
      <div className="page-head">
        <div><h2>Transcripts</h2><p>{groups.length} session transcripts</p></div>
      </div>
      <div className="toolbar"><Search value={q} onChange={setQ} placeholder="Search inside transcripts…" /></div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState icon={<FiFileText />} title="No transcripts" text="Conversation records will appear here after sessions run." />
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Exam</th><th>Turns</th><th>Result</th><th>Recorded</th><th></th></tr></thead>
              <tbody>
                {filtered.map((g) => (
                  <tr key={g.id}>
                    <td className="tbl__primary">{g.exam_type}</td>
                    <td><span className="badge badge--gray"><FiMessageSquare /> {g.turns.length}</span></td>
                    <td>{g.result ? <Badge color={resultBadge(g.result)}>{g.result}</Badge> : '—'}</td>
                    <td className="muted">{fmtDateTime(g.created_at)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex" style={{ justifyContent: 'flex-end', gap: 4 }}>
                        <IconButton icon={<FiEye />} onClick={() => setView(g)} />
                        <IconButton icon={<FiDownload />} onClick={() => dl(g)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {view && (
        <Modal wide title={`${view.exam_type} transcript`} onClose={() => setView(null)}
          footer={<Button icon={<FiDownload />} onClick={() => dl(view)}>Download .txt</Button>}>
          <p className="muted">{fmtDateTime(view.created_at)}</p>
          <div className="scrollbox" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {view.turns.map((t) => (
              <div key={t.id} style={{ padding: '10px 14px', borderRadius: 12, background: t.role === 'examiner' ? '#f6f9ff' : '#f3fbf9', border: '1px solid var(--line-2)' }}>
                <div className="flex between" style={{ marginBottom: 4 }}>
                  <span style={{ fontWeight: 800, fontSize: '0.7rem', letterSpacing: '0.06em', color: t.role === 'examiner' ? 'var(--accent)' : '#0d9488' }}>{t.role.toUpperCase()}</span>
                  <span className="muted" style={{ fontSize: '0.72rem' }}>{t.time_marker}</span>
                </div>
                <p style={{ fontSize: '0.9rem' }}>{t.text}</p>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  )
}

function dl(g) {
  const lines = [
    `PassGP Transcript — ${g.exam_type}`,
    `Recorded: ${fmtDateTime(g.created_at)}`,
    '─'.repeat(50), '',
    ...g.turns.map((t) => `[${t.time_marker || ''}] ${t.role.toUpperCase()}: ${t.text}`),
  ]
  downloadFile(`transcript-${g.id}.txt`, lines.join('\n'))
}
