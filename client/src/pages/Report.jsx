import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { useExam } from '../context/ExamContext'
import { apiUrl } from '../services/config'
import { ScoreGauge, RadarChart, DomainBars } from '../components/charts/Charts'
import './Report.css'

const DEFAULT_DOMAINS = ['Clinical Reasoning', 'Diagnosis', 'Management', 'Communication']

export default function Report() {
  const navigate = useNavigate()
  const { sessionData, clearSession } = useExam()
  const reportRef = useRef(null)
  const [exporting, setExporting] = useState(false)
  const [emailState, setEmailState] = useState('idle') // idle | sending | sent | error
  const [emailTo, setEmailTo] = useState('')
  const autoSentRef = useRef(false)

  const sd = sessionData || {}
  const {
    durationSec = 0,
    questionsAnswered = 0,
    wordCount = 0,
    transcript = [],
    date,
    questionTitle = 'Clinical case',
    examType = 'RACGP',
    candidateName = '',
    candidateEmail = '',
    pathway = '',
    isMock = false,
    stations = [],
  } = sd

  const fb = sd.feedback || {}
  const domains =
    fb.domains && fb.domains.length
      ? fb.domains
      : DEFAULT_DOMAINS.map((n) => ({ name: n, score: 60, comment: '' }))
  const score = fb.score ?? Math.round(domains.reduce((a, b) => a + b.score, 0) / domains.length)
  const overall = fb.overall_score ?? Math.round(score / 10)
  const result =
    fb.result ||
    (overall >= 9 ? 'Excellent' : overall >= 7 ? 'Competent' : overall >= 5 ? 'Borderline Pass' : 'Needs Significant Improvement')
  const summary = fb.summary || ''
  const detailed = fb.detailedFeedback || fb.examiner_comments || ''
  const strengths = fb.strengths || []
  const improvements = fb.improvements || fb.weaknesses || []
  const recommendations = fb.recommendations || []
  const missedItems = fb.missed_items || []
  const unsafeAreas = fb.unsafe_areas || []
  const passFail = fb.pass_fail || ''
  const marksAwarded = fb.marks_awarded
  const totalMarks = fb.total_marks
  const killerFailed = fb.killer_failed
  const timeStr = fmtTime(durationSec)
  const rl = result.toLowerCase()
  const resultClass = rl.includes('excellent') || rl.includes('competent') ? 'pass' : rl.includes('needs') || rl.includes('below') ? 'fail' : 'merit'

  // Render the on-screen report (incl. charts) to a jsPDF doc. Shared by the
  // download button and the auto-email, so the emailed PDF is identical.
  async function buildPdf(quality = 'png') {
    const canvas = await html2canvas(reportRef.current, {
      scale: quality === 'jpeg' ? 1.6 : 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    })
    const fmt = quality === 'jpeg' ? 'JPEG' : 'PNG'
    const img = canvas.toDataURL(quality === 'jpeg' ? 'image/jpeg' : 'image/png', 0.85)
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const imgH = (canvas.height * pageW) / canvas.width
    let heightLeft = imgH
    let position = 0
    pdf.addImage(img, fmt, 0, position, pageW, imgH)
    heightLeft -= pageH
    while (heightLeft > 0) {
      position -= pageH
      pdf.addPage()
      pdf.addImage(img, fmt, 0, position, pageW, imgH)
      heightLeft -= pageH
    }
    return pdf
  }

  async function downloadPDF() {
    if (!reportRef.current) return
    setExporting(true)
    try {
      const pdf = await buildPdf('png')
      pdf.save(`PassGP-Report-${candidateName ? candidateName.replace(/[^a-z0-9]+/gi, '-') : Date.now()}.pdf`)
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert('Could not generate the PDF. Please try again.')
      console.error(e)
    } finally {
      setExporting(false)
    }
  }

  // Build + email the exact on-screen report (with charts) to an address.
  async function sendReportEmail(to) {
    const email = String(to || '').trim()
    if (!email || !reportRef.current) { setEmailState('error'); return }
    try {
      setEmailState('sending')
      const pdf = await buildPdf('jpeg') // smaller image for email
      const dataUri = pdf.output('datauristring') // data:application/pdf;base64,...
      const res = await fetch(apiUrl('/api/email-report'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateEmail: email, candidateName,
          examType: pathway || examType,
          pdfBase64: dataUri,
          report: { ...fb, examiner_comments: detailed, pass_fail: passFail },
        }),
      })
      const d = await res.json().catch(() => ({}))
      setEmailState(d?.sent ? 'sent' : 'error')
    } catch (e) {
      console.error('Email report failed:', e)
      setEmailState('error')
    }
  }

  // Redirect home if there's no session.
  useEffect(() => {
    if (!sessionData) { const t = setTimeout(() => navigate('/'), 100); return () => clearTimeout(t) }
  }, [sessionData, navigate])

  // Prefill the manual email box with the registered email.
  useEffect(() => { if (candidateEmail) setEmailTo(candidateEmail) }, [candidateEmail])

  // Auto-email once, after the charts have had time to render.
  useEffect(() => {
    if (!sessionData || !candidateEmail || autoSentRef.current) return
    autoSentRef.current = true
    const t = setTimeout(() => { sendReportEmail(candidateEmail) }, 2200)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line

  if (!sessionData) return null

  return (
    <div className="rp-page">
      {/* Toolbar (not captured in the PDF) */}
      <div className="rp-toolbar">
        <button className="rp-tbtn rp-tbtn-ghost" onClick={() => { clearSession(); navigate('/exam') }}>
          ← New session
        </button>
        <div className="rp-email-box">
          {emailState === 'sent' ? (
            <span className="rp-email-status" data-state="sent">✓ Report emailed to {emailTo}</span>
          ) : (
            <>
              <input className="rp-email-input" type="email" value={emailTo} placeholder="your@email.com"
                onChange={(e) => setEmailTo(e.target.value)} />
              <button className="rp-tbtn rp-tbtn-ghost" onClick={() => sendReportEmail(emailTo)}
                disabled={emailState === 'sending' || !emailTo.trim()}>
                {emailState === 'sending' ? <><span className="rp-spin" /> Sending…</> : '✉ Email report'}
              </button>
            </>
          )}
          {emailState === 'error' && <span className="rp-email-status" data-state="error">Couldn’t send — try again</span>}
        </div>
        <button className="rp-tbtn rp-tbtn-primary" onClick={downloadPDF} disabled={exporting}>
          {exporting ? (
            <>
              <span className="rp-spin" /> Preparing PDF…
            </>
          ) : (
            <>⬇ Download PDF report</>
          )}
        </button>
      </div>

      {/* The printable document */}
      <div className="rp-doc" ref={reportRef}>
        {/* Header band */}
        <div className="rp-band">
          <div className="rp-band-left">
            <div className="rp-logo">
              <span className="rp-logo-badge">PG</span>
              <span className="rp-logo-text">PassGP</span>
            </div>
            <h1 className="rp-title">AI Oral Examiner — Performance Report</h1>
            {candidateName && <div className="rp-candidate">{candidateName}{pathway ? ` · ${pathway}` : ''}</div>}
            <div className="rp-meta">
              <span>{examType}</span>
              <span>•</span>
              <span>{questionTitle}</span>
              <span>•</span>
              <span>{date}</span>
            </div>
          </div>
          <div className={`rp-band-result rp-result-${resultClass}`}>
            <span className="rp-result-band">{passFail || result}</span>
            <span className="rp-result-sub">{passFail ? `${result} · Overall outcome` : 'Overall outcome'}</span>
          </div>
        </div>

        {killerFailed && (
          <div className="rp-killer">⚠ Critical safety failure — this station is an automatic fail regardless of marks.</div>
        )}

        {/* Stat strip */}
        <div className="rp-stats">
          <Stat icon="⏱" label="Duration" value={timeStr} />
          {marksAwarded != null && totalMarks ? (
            <Stat icon="✓" label="Marks" value={`${marksAwarded}/${totalMarks}`} />
          ) : (
            <Stat icon="❓" label="Questions" value={questionsAnswered} />
          )}
          <Stat icon="💬" label="Words spoken" value={wordCount} />
          <Stat icon="🎯" label="Overall" value={`${overall}/10`} />
        </div>

        {/* Mock circuit summary (#10) */}
        {isMock && stations.length > 0 && (
          <div className="rp-section">
            <h3 className="rp-section-title">Circuit summary — {stations.length} stations</h3>
            <div className="rp-station-grid">
              {stations.map((st) => {
                const sScore = st.feedback?.score
                const sOverall = sScore != null ? Math.round(sScore / 10) : null
                const sPass = st.feedback?.pass_fail
                return (
                  <div key={st.station} className="rp-station-card">
                    <div className="rp-station-no">Station {st.station}</div>
                    <div className="rp-station-title">{st.title}</div>
                    <div className="rp-station-score">{sOverall != null ? `${sOverall}/10` : '—'}</div>
                    {sPass && <span className={`rp-station-badge ${/fail/i.test(sPass) ? 'fail' : 'pass'}`}>{sPass}</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Charts row */}
        <div className="rp-charts">
          <div className="rp-chart-card rp-chart-gauge">
            <h3 className="rp-card-title">Overall score</h3>
            <ScoreGauge score={score} />
            <p className="rp-gauge-cap">Weighted across five competency domains</p>
          </div>
          <div className="rp-chart-card">
            <h3 className="rp-card-title">Competency profile</h3>
            <RadarChart domains={domains} />
          </div>
        </div>

        {/* Domain breakdown */}
        <div className="rp-section">
          <h3 className="rp-section-title">Domain breakdown</h3>
          <DomainBars domains={domains} />
          <div className="rp-domain-comments">
            {domains.filter((d) => d.comment).map((d) => (
              <div key={d.name} className="rp-domain-comment">
                <strong>{d.name}.</strong> {d.comment}
              </div>
            ))}
          </div>
        </div>

        {/* Summary + detailed narrative */}
        {(summary || detailed) && (
          <div className="rp-section">
            <h3 className="rp-section-title">Examiner assessment</h3>
            {summary && <p className="rp-lead">{summary}</p>}
            {detailed && <p className="rp-detailed">{detailed}</p>}
          </div>
        )}

        {/* Strengths / Improvements / Recommendations */}
        <div className="rp-cols">
          <FeedbackList title="Strengths" items={strengths} tone="good" emptyText="No specific strengths recorded." />
          <FeedbackList title="Areas to improve" items={improvements} tone="warn" emptyText="No improvement points recorded." />
        </div>
        {(missedItems.length > 0 || unsafeAreas.length > 0) && (
          <div className="rp-cols">
            {missedItems.length > 0 && <FeedbackList title="Missed key items" items={missedItems} tone="warn" emptyText="" />}
            {unsafeAreas.length > 0 && <FeedbackList title="Unsafe / red-flag areas" items={unsafeAreas} tone="warn" emptyText="" />}
          </div>
        )}
        {recommendations.length > 0 && (
          <div className="rp-section">
            <h3 className="rp-section-title">Recommended next steps</h3>
            <ol className="rp-reco">
              {recommendations.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ol>
          </div>
        )}

        {/* Transcript */}
        <div className="rp-section">
          <h3 className="rp-section-title">Session transcript</h3>
          <div className="rp-transcript">
            {transcript.length === 0 ? (
              <p className="rp-empty">No transcript was recorded for this session.</p>
            ) : (
              transcript.map((t, i) => (
                <div key={i} className={`rp-turn rp-turn-${t.role}`}>
                  <div className="rp-turn-meta">
                    <span className="rp-turn-role">{t.role === 'examiner' ? 'EXAMINER' : 'CANDIDATE'}</span>
                    {t.time && <span className="rp-turn-time">{t.time}</span>}
                  </div>
                  <p className="rp-turn-text">{t.text}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="rp-footer">
          <span>Generated by PassGP — AI Oral Examiner</span>
          <span>This report is a training aid and not a formal examination result.</span>
        </div>
      </div>
    </div>
  )
}

function Stat({ icon, label, value }) {
  return (
    <div className="rp-stat">
      <div className="rp-stat-icon">{icon}</div>
      <div className="rp-stat-val">{value}</div>
      <div className="rp-stat-label">{label}</div>
    </div>
  )
}

function FeedbackList({ title, items, tone, emptyText }) {
  return (
    <div className="rp-section rp-fb">
      <h3 className="rp-section-title">{title}</h3>
      {items.length === 0 ? (
        <p className="rp-empty">{emptyText}</p>
      ) : (
        <ul className={`rp-fb-list rp-fb-${tone}`}>
          {items.map((it, i) => (
            <li key={i}>
              <span className="rp-fb-mark">{tone === 'good' ? '✓' : '!'}</span>
              {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function fmtTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0')
  const s = String(sec % 60).padStart(2, '0')
  return `${m}:${s}`
}
