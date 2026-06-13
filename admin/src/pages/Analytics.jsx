import { useEffect, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { Card, PageLoader, EmptyState } from '../components/ui'
import { FiBarChart2 } from 'react-icons/fi'

const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#3b82f6']

export default function Analytics() {
  const [loading, setLoading] = useState(true)
  const [growth, setGrowth] = useState([])
  const [byExam, setByExam] = useState([])
  const [scoreTrend, setScoreTrend] = useState([])
  const [dist, setDist] = useState([])
  const [empty, setEmpty] = useState(false)

  useEffect(() => {
    ;(async () => {
      const [{ data: profiles }, { data: sessions }] = await Promise.all([
        supabase.from('profiles').select('created_at'),
        supabase.from('exam_sessions').select('created_at, exam_type, score'),
      ])
      const sess = sessions || []
      setEmpty(sess.length === 0 && (profiles || []).length === 0)

      // user growth (cumulative, last 12 weeks)
      setGrowth(buildGrowth(profiles || []))

      // sessions by exam type
      const exMap = {}
      sess.forEach((s) => { exMap[s.exam_type || 'Other'] = (exMap[s.exam_type || 'Other'] || 0) + 1 })
      setByExam(Object.entries(exMap).map(([name, value]) => ({ name, value })))

      // average score trend by week
      setScoreTrend(buildScoreTrend(sess))

      // score distribution buckets (/10)
      const buckets = [0, 0, 0, 0, 0] // 0-2,3-4,5-6,7-8,9-10
      sess.forEach((s) => {
        if (s.score == null) return
        const v = s.score / 10
        const i = v <= 2 ? 0 : v <= 4 ? 1 : v <= 6 ? 2 : v <= 8 ? 3 : 4
        buckets[i]++
      })
      setDist([
        { name: '0–2', value: buckets[0] }, { name: '3–4', value: buckets[1] },
        { name: '5–6', value: buckets[2] }, { name: '7–8', value: buckets[3] }, { name: '9–10', value: buckets[4] },
      ])

      setLoading(false)
    })()
  }, [])

  if (loading) return <PageLoader />
  if (empty) {
    return (
      <Card><EmptyState icon={<FiBarChart2 />} title="No data to analyse yet" text="Charts will populate as candidates sign up and take exams." /></Card>
    )
  }

  return (
    <>
      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <Card title="Candidate growth" sub="Cumulative sign-ups">
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={growth} margin={{ top: 8, right: 10, left: -16, bottom: 0 }}>
              <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.35} /><stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={tip} />
              <Area type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#ag)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Sessions by exam pathway" sub="Distribution of attempts">
          {byExam.length === 0 ? <EmptyState title="No sessions yet" /> : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={byExam} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3}>
                  {byExam.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tip} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div className="grid grid-2">
        <Card title="Average score trend" sub="Mean score per week (/10)">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={scoreTrend} margin={{ top: 8, right: 10, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={tip} />
              <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Score distribution" sub="How candidates score">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dist} margin={{ top: 8, right: 10, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={tip} cursor={{ fill: '#f6f8fc' }} />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {dist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </>
  )
}

const tip = { borderRadius: 12, border: '1px solid #e8ecf3', fontSize: 13 }

function weekKey(d) {
  const date = new Date(d)
  const onejan = new Date(date.getFullYear(), 0, 1)
  const week = Math.ceil(((date - onejan) / 864e5 + onejan.getDay() + 1) / 7)
  return `${date.getFullYear()}-W${week}`
}
function buildGrowth(profiles) {
  const sorted = [...profiles].filter((p) => p.created_at).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const weeks = []
  const map = {}
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.now() - i * 7 * 864e5)
    const k = weekKey(d)
    map[k] = 0
    weeks.push({ key: k, label: d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) })
  }
  sorted.forEach((p) => { const k = weekKey(p.created_at); if (k in map) map[k]++ })
  let cum = 0
  return weeks.map((w) => { cum += map[w.key]; return { label: w.label, value: cum } })
}
function buildScoreTrend(sessions) {
  const weeks = []
  const sum = {}
  const cnt = {}
  for (let i = 7; i >= 0; i--) {
    const d = new Date(Date.now() - i * 7 * 864e5)
    const k = weekKey(d)
    sum[k] = 0; cnt[k] = 0
    weeks.push({ key: k, label: d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) })
  }
  sessions.forEach((s) => { if (s.score == null) return; const k = weekKey(s.created_at); if (k in sum) { sum[k] += s.score / 10; cnt[k]++ } })
  return weeks.map((w) => ({ label: w.label, value: cnt[w.key] ? +(sum[w.key] / cnt[w.key]).toFixed(1) : 0 }))
}
