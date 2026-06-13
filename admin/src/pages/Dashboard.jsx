import { useEffect, useState } from 'react'
import {
  FiUsers, FiClipboard, FiHelpCircle, FiCpu, FiTrendingUp, FiActivity, FiArrowUpRight,
} from 'react-icons/fi'
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, CartesianGrid } from 'recharts'
import { supabase } from '../lib/supabase'
import { Card, StatCard, PageLoader, EmptyState, Badge } from '../components/ui'
import { fmtDateTime, timeAgo, initials, resultBadge } from '../lib/format'

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ users: 0, exams: 0, questions: 0, sessions: 0 })
  const [recent, setRecent] = useState([])
  const [series, setSeries] = useState([])

  useEffect(() => {
    ;(async () => {
      const head = { count: 'exact', head: true }
      const [users, questions, sessionsAll, examsDone, recentRows, last30] = await Promise.all([
        supabase.from('profiles').select('*', head),
        supabase.from('exam_questions').select('*', head),
        supabase.from('exam_sessions').select('*', head),
        supabase.from('exam_sessions').select('*', head).eq('status', 'completed'),
        supabase.from('exam_sessions').select('id, exam_type, score, result, status, created_at, user_id').order('created_at', { ascending: false }).limit(8),
        supabase.from('exam_sessions').select('created_at').gte('created_at', new Date(Date.now() - 29 * 864e5).toISOString()),
      ])

      setStats({
        users: users.count || 0,
        questions: questions.count || 0,
        sessions: sessionsAll.count || 0,
        exams: examsDone.count || 0,
      })
      setRecent(recentRows.data || [])
      setSeries(buildSeries(last30.data || []))
      setLoading(false)
    })()
  }, [])

  if (loading) return <PageLoader />

  return (
    <>
      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <StatCard icon={<FiUsers />} color="indigo" value={stats.users} label="Total Candidates" trend={{ dir: 'up', icon: <FiTrendingUp />, text: 'Live' }} />
        <StatCard icon={<FiClipboard />} color="violet" value={stats.exams} label="Exams Completed" />
        <StatCard icon={<FiHelpCircle />} color="cyan" value={stats.questions} label="Questions in Bank" />
        <StatCard icon={<FiCpu />} color="green" value={stats.sessions} label="Total AI Sessions" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.6fr 1fr', marginBottom: 20 }}>
        <Card title="Sessions — last 30 days" sub="AI examiner sessions over time">
          {series.every((s) => s.value === 0) ? (
            <EmptyState icon={<FiActivity />} title="No sessions yet" text="Activity will appear here once candidates start practising." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={4} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e8ecf3', fontSize: 13 }} />
                <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2.5} fill="url(#g1)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Platform health" sub="At a glance">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Health label="Average score" value={avg(recent)} suffix="/10" />
            <Health label="Completion rate" value={completionRate(stats)} suffix="%" />
            <Health label="Active question bank" value={stats.questions} suffix="" />
          </div>
        </Card>
      </div>

      <Card title="Recent activity" sub="Latest exam sessions" bodyClass="" className="">
        {recent.length === 0 ? (
          <EmptyState title="No activity yet" text="Sessions will show up here in real time." />
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Candidate</th><th>Exam</th><th>Score</th><th>Result</th><th>Status</th><th>When</th></tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="tbl__cell-user">
                        <span className="tbl__avatar">{r.user_id ? initials('', r.user_id) : 'AN'}</span>
                        <span className="tbl__primary">{r.user_id ? 'Candidate' : 'Anonymous'}</span>
                      </div>
                    </td>
                    <td>{r.exam_type || '—'}</td>
                    <td className="mono">{r.score != null ? `${Math.round(r.score / 10)}/10` : '—'}</td>
                    <td>{r.result ? <Badge color={resultBadge(r.result)}>{r.result}</Badge> : '—'}</td>
                    <td><Badge color={r.status === 'completed' ? 'green' : 'amber'} dot>{r.status || 'in progress'}</Badge></td>
                    <td className="muted">{timeAgo(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}

function Health({ label, value, suffix }) {
  return (
    <div className="flex between items-center">
      <span className="muted" style={{ fontSize: '0.9rem' }}>{label}</span>
      <span style={{ fontFamily: 'var(--head)', fontWeight: 800, fontSize: '1.3rem', color: 'var(--ink)' }}>
        {value}<span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{suffix}</span>
      </span>
    </div>
  )
}

function avg(rows) {
  const scored = rows.filter((r) => r.score != null)
  if (!scored.length) return '—'
  return (scored.reduce((a, b) => a + b.score, 0) / scored.length / 10).toFixed(1)
}
function completionRate(stats) {
  if (!stats.sessions) return 0
  return Math.round((stats.exams / stats.sessions) * 100)
}
function buildSeries(rows) {
  const days = []
  const map = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5)
    const key = d.toISOString().slice(0, 10)
    map[key] = 0
    days.push({ key, label: d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) })
  }
  rows.forEach((r) => {
    const key = String(r.created_at).slice(0, 10)
    if (key in map) map[key]++
  })
  return days.map((d) => ({ label: d.label, value: map[d.key] }))
}
