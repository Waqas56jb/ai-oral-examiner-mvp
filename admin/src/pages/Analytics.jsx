import { useEffect, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { apiGet } from '../lib/api'
import { Card, PageLoader, EmptyState, Button } from '../components/ui'
import { toCsv, downloadFile } from '../lib/format'
import { FiBarChart2, FiDownload, FiDatabase } from 'react-icons/fi'

const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#3b82f6']

export default function Analytics() {
  const [loading, setLoading] = useState(true)
  const [growth, setGrowth] = useState([])
  const [byExam, setByExam] = useState([])
  const [scoreTrend, setScoreTrend] = useState([])
  const [dist, setDist] = useState([])
  const [weaknesses, setWeaknesses] = useState([])
  const [cohorts, setCohorts] = useState([])
  const [attempts, setAttempts] = useState([])
  const [empty, setEmpty] = useState(false)

  useEffect(() => {
    ;(async () => {
      const [{ data: profiles }, { data: sessions }] = await Promise.all([
        supabase.from('profiles').select('created_at'),
        supabase.from('exam_sessions').select('created_at, exam_type, pathway, score, pass_fail, result, improvements, missed_items, unsafe_areas'),
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

      // Top recurring weaknesses (aggregate improvements + missed + unsafe arrays)
      const wMap = {}
      sess.forEach((s) => {
        ;[...(s.improvements || []), ...(s.missed_items || []), ...(s.unsafe_areas || [])].forEach((raw) => {
          const k = String(raw || '').trim().toLowerCase()
          if (!k) return
          if (!wMap[k]) wMap[k] = { label: String(raw).trim(), value: 0 }
          wMap[k].value++
        })
      })
      setWeaknesses(Object.values(wMap).sort((a, b) => b.value - a.value).slice(0, 8))

      // Cohort benchmarking (#17): pass rate + avg score by pathway
      const cMap = {}
      sess.forEach((s) => {
        const k = s.pathway || s.exam_type || 'Unspecified'
        if (!cMap[k]) cMap[k] = { name: k, attempts: 0, passes: 0, scoreSum: 0, scored: 0 }
        cMap[k].attempts++
        const passed = s.pass_fail ? !/fail/i.test(s.pass_fail) : s.score != null ? s.score >= 50 : false
        if (passed) cMap[k].passes++
        if (s.score != null) { cMap[k].scoreSum += s.score / 10; cMap[k].scored++ }
      })
      setCohorts(Object.values(cMap).map((c) => ({
        name: c.name, attempts: c.attempts,
        passRate: c.attempts ? Math.round((c.passes / c.attempts) * 100) : 0,
        avgScore: c.scored ? +(c.scoreSum / c.scored).toFixed(1) : 0,
      })).sort((a, b) => b.attempts - a.attempts))

      // Attempts per case category (#8)
      setAttempts(Object.entries(exMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10))

      setLoading(false)
    })()
  }, [])

  const exportCsv = () => {
    const csv = toCsv(cohorts, [
      { label: 'Cohort (pathway)', key: 'name' },
      { label: 'Attempts', key: 'attempts' },
      { label: 'Pass rate %', key: 'passRate' },
      { label: 'Avg score /10', key: 'avgScore' },
    ])
    downloadFile(`passgp-analytics-${Date.now()}.csv`, csv, 'text/csv')
  }

  const [exportingBI, setExportingBI] = useState(false)
  // Full session-level, Power BI-ready export (one row per attempt, all fields).
  const exportPowerBI = async () => {
    setExportingBI(true)
    try {
      const { rows } = await apiGet('/api/admin/analytics/export')
      if (!rows?.length) return
      const headers = Object.keys(rows[0]).map((k) => ({ label: k, key: k }))
      downloadFile(`passgp-powerbi-sessions-${Date.now()}.csv`, toCsv(rows, headers), 'text/csv')
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert('Export failed: ' + e.message)
    } finally {
      setExportingBI(false)
    }
  }

  if (loading) return <PageLoader />
  if (empty) {
    return (
      <Card><EmptyState icon={<FiBarChart2 />} title="No data to analyse yet" text="Charts will populate as candidates sign up and take exams." /></Card>
    )
  }

  return (
    <>
      <div className="page-head">
        <div><h2>Analytics</h2><p>Performance, progression & cohort benchmarking</p></div>
        <div className="page-actions">
          <Button variant="ghost" icon={<FiDownload />} onClick={exportCsv}>Export cohort CSV</Button>
          <Button variant="ghost" loading={exportingBI} icon={<FiDatabase />} onClick={exportPowerBI}>Power BI export</Button>
        </div>
      </div>

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

      <div className="grid grid-2" style={{ marginTop: 20 }}>
        <Card title="Cohort benchmarking" sub="Pass rate & average score by exam pathway">
          {cohorts.length === 0 ? <EmptyState title="No cohort data yet" /> : (
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Cohort</th><th>Attempts</th><th>Pass rate</th><th>Avg /10</th></tr></thead>
                <tbody>
                  {cohorts.map((c) => (
                    <tr key={c.name}>
                      <td className="tbl__primary">{c.name}</td>
                      <td className="mono">{c.attempts}</td>
                      <td><div className="bench-bar"><span style={{ width: `${c.passRate}%`, background: c.passRate >= 50 ? '#10b981' : '#f59e0b' }} /></div><span className="mono" style={{ fontSize: '0.78rem' }}>{c.passRate}%</span></td>
                      <td className="mono">{c.avgScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Top recurring weaknesses" sub="Most common improvement / unsafe areas across all sessions">
          {weaknesses.length === 0 ? <EmptyState title="No weakness data yet" /> : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={weaknesses} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={140} />
                <Tooltip contentStyle={tip} cursor={{ fill: '#f6f8fc' }} />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div className="grid grid-2" style={{ marginTop: 20 }}>
        <Card title="Attempts per category" sub="Where candidates are practising most">
          {attempts.length === 0 ? <EmptyState title="No attempts yet" /> : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={attempts} margin={{ top: 8, right: 10, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                <Tooltip contentStyle={tip} cursor={{ fill: '#f6f8fc' }} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#06b6d4" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
        <div />
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
