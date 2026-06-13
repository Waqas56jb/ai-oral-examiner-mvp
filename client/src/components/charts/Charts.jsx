/* Lightweight, dependency-free SVG charts — crisp and PDF-capture friendly. */

const gradeColor = (v) => (v >= 80 ? '#16a34a' : v >= 65 ? '#f59e0b' : '#ef4444')

/* ---------------- Overall score gauge (radial ring) ---------------- */
export function ScoreGauge({ score = 0, size = 200, stroke = 16 }) {
  const r = (size - stroke) / 2
  const cx = size / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, score))
  const offset = c - (pct / 100) * c
  const color = gradeColor(pct)

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="chart-gauge">
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="#e9eef5" strokeWidth={stroke} />
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${cx} ${cx})`}
      />
      <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.26} fontWeight="800" fill="#0f172a" fontFamily="Sora, sans-serif">
        {pct}
      </text>
      <text x="50%" y="64%" textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.085} fill="#64748b" fontFamily="Inter, sans-serif" letterSpacing="1.5">
        / 100
      </text>
    </svg>
  )
}

/* ---------------- Competency radar ---------------- */
export function RadarChart({ domains = [], size = 320 }) {
  const cx = size / 2
  const cy = size / 2
  const R = size / 2 - 54
  const n = domains.length || 1
  const ang = (i) => (Math.PI * 2 * i) / n - Math.PI / 2
  const pt = (i, val) => {
    const rr = R * (Math.max(0, Math.min(100, val)) / 100)
    return [cx + rr * Math.cos(ang(i)), cy + rr * Math.sin(ang(i))]
  }
  const gridPoly = (frac) =>
    domains
      .map((_, i) => {
        const x = cx + R * frac * Math.cos(ang(i))
        const y = cy + R * frac * Math.sin(ang(i))
        return `${x},${y}`
      })
      .join(' ')

  const dataPoly = domains.map((d, i) => pt(i, d.score).join(',')).join(' ')

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="chart-radar">
      {/* grid rings */}
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={gridPoly(f)} fill="none" stroke="#e2e8f0" strokeWidth="1" />
      ))}
      {/* axes */}
      {domains.map((_, i) => {
        const [x, y] = [cx + R * Math.cos(ang(i)), cy + R * Math.sin(ang(i))]
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e2e8f0" strokeWidth="1" />
      })}
      {/* data area */}
      <polygon points={dataPoly} fill="rgba(37,99,235,0.18)" stroke="#2563eb" strokeWidth="2.5" strokeLinejoin="round" />
      {domains.map((d, i) => {
        const [x, y] = pt(i, d.score)
        return <circle key={i} cx={x} cy={y} r="4" fill="#2563eb" />
      })}
      {/* labels */}
      {domains.map((d, i) => {
        const lx = cx + (R + 26) * Math.cos(ang(i))
        const ly = cy + (R + 26) * Math.sin(ang(i))
        const anchor = Math.abs(Math.cos(ang(i))) < 0.3 ? 'middle' : lx > cx ? 'start' : 'end'
        return (
          <text key={i} x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle" fontSize="11" fontWeight="600" fill="#334155" fontFamily="Inter, sans-serif">
            {shortLabel(d.name)}
          </text>
        )
      })}
    </svg>
  )
}

/* ---------------- Domain breakdown bars ---------------- */
export function DomainBars({ domains = [] }) {
  return (
    <div className="chart-bars">
      {domains.map((d) => (
        <div key={d.name} className="chart-bar-row">
          <div className="chart-bar-label">{d.name}</div>
          <div className="chart-bar-track">
            <div
              className="chart-bar-fill"
              style={{ width: `${Math.max(0, Math.min(100, d.score))}%`, background: gradeColor(d.score) }}
            />
          </div>
          <div className="chart-bar-val">{d.score}</div>
        </div>
      ))}
    </div>
  )
}

function shortLabel(name) {
  return name
    .replace('Clinical Reasoning', 'Reasoning')
    .replace('Communication', 'Comms')
    .replace('Safety & Red Flags', 'Safety')
    .replace('Structured Approach', 'Structure')
    .replace('Clinical Knowledge', 'Knowledge')
    .replace('Time Management', 'Timing')
}
