import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import WidgetDesign from '../components/WidgetDesign'
import { useExam } from '../context/ExamContext'
import { startRealtimeExam } from '../services/realtimeClient'
import { apiUrl } from '../services/config'
import { WIDGET_THEMES, DEFAULT_THEME } from '../services/widgetThemes'
import './VoiceAgent.css'
import '../styles/widgetTheme.css'

// Empty = let the examiner pick ANY case from the training set (its own
// category is used). A specific category can be forced via ?exam=...
const EXAM_TYPE = ''

// Exam pathways the candidate can register under (kept in sync with the admin case builder).
const PATHWAYS = ['RACGP CCE', 'StAMPS (ACRRM)', 'AMC Clinical', 'PESCI', 'RANZCOG OSCE', 'RACP Clinical', 'KFP', 'AKT', 'NZREX', 'Other']

// Countdown warning thresholds (seconds remaining).
const WARN_AT = 60

const BAR_HEIGHTS = [4,7,12,18,26,34,40,42,38,30,22,16,12,9,16,24,34,42,40,34,26,18,12,7,5,4,8,11]

const STATE_META = {
  idle:       { label: 'Ready to begin',    status: 'Tap to start',   sub: 'Your examiner is waiting' },
  connecting: { label: 'Connecting…',        status: 'One moment',     sub: 'Setting up your secure voice session' },
  listen:     { label: 'Listening…',         status: 'Go ahead',       sub: 'Speak your answer clearly' },
  think:      { label: 'Thinking…',          status: 'Just a moment',  sub: 'The examiner is considering your answer' },
  speak:      { label: 'Examiner speaking',  status: 'Listen',         sub: 'The examiner is responding' },
  finishing:  { label: 'Wrapping up…',        status: 'Almost done',    sub: 'Generating your feedback report' },
  error:      { label: 'Connection issue',    status: 'Tap to retry',   sub: 'We couldn’t reach the examiner' },
  maintenance:{ label: 'Just a moment',        status: 'Coming soon',    sub: 'The examiner is being prepared' },
}

// OrbCanvas / WaveRing only know idle|listen|think|speak — map the rest.
const orbStateFor = (s) =>
  s === 'connecting' || s === 'finishing' ? 'think' : s === 'error' || s === 'maintenance' ? 'idle' : s

// Read ?formId=... (and optional ?exam=...) so a Kajabi/Jotform embed can tell
// the examiner exactly which clinical case to run.
function readParams() {
  try {
    const p = new URLSearchParams(window.location.search)
    return { formId: p.get('formId') || p.get('form') || null, exam: p.get('exam') || EXAM_TYPE }
  } catch {
    return { formId: null, exam: EXAM_TYPE }
  }
}

export default function VoiceAgent() {
  const navigate = useNavigate()
  const { setSessionData } = useExam()
  const params = useRef(readParams()).current
  const [theme, setTheme] = useState({ ...WIDGET_THEMES[DEFAULT_THEME], id: DEFAULT_THEME })

  // Apply the admin-selected widget appearance
  useEffect(() => {
    let active = true
    fetch(apiUrl('/api/widget-theme'))
      .then((r) => r.json())
      .then((d) => {
        const t = WIDGET_THEMES[d?.template]
        if (active && t) setTheme({ ...t, id: d.template })
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  // Candidate registration (#2): captured before the exam so reports are never "Unnamed".
  const [registered, setRegistered] = useState(false)
  const [reg, setReg] = useState({ name: '', email: '', pathway: params.exam || '' })
  const regRef = useRef(reg)

  // Countdown timer (#6)
  const [remaining, setRemaining] = useState(null) // seconds left, null until started
  const [timeUp, setTimeUp] = useState(false)
  const limitRef = useRef(480)
  const warnedRef = useRef(false)
  const endRef = useRef(null)

  const [examState, setExamState] = useState('idle')
  const [running,   setRunning]   = useState(false)
  const [muted,     setMuted]     = useState(false)
  const [sessionSec, setSessionSec] = useState(0)
  const [wordCount,  setWordCount]  = useState(0)
  const [turns,      setTurns]      = useState(0)
  const [latency,    setLatency]    = useState('—')
  const [liveCaption, setLiveCaption] = useState('')
  const [errorMsg,   setErrorMsg]   = useState('')

  const sessionRef      = useRef(null)   // realtime controller
  const sessionTimerRef = useRef(null)
  const sessionSecRef   = useRef(0)
  const wordCountRef    = useRef(0)
  const turnsRef        = useRef(0)
  const transcriptRef   = useRef([])
  const startedRef      = useRef(false)
  const questionRef     = useRef({ id: null, title: null })

  const stopTimer = () => clearInterval(sessionTimerRef.current)

  const startTimer = useCallback(() => {
    stopTimer()
    sessionTimerRef.current = setInterval(() => {
      sessionSecRef.current += 1
      setSessionSec(sessionSecRef.current)

      // Countdown + warnings + auto-termination (#6)
      const left = Math.max(0, limitRef.current - sessionSecRef.current)
      setRemaining(left)
      if (left <= WARN_AT && !warnedRef.current) {
        warnedRef.current = true
        setTimeUp(false) // ensure warning banner shows, not the ended state yet
      }
      if (left <= 0) {
        stopTimer()
        setTimeUp(true)
        endRef.current?.()
      }
    }, 1000)
  }, [])

  const pushTurn = useCallback((role, text) => {
    transcriptRef.current.push({ role, text, time: fmtTime(sessionSecRef.current) })
    wordCountRef.current += text.split(/\s+/).filter(Boolean).length
    setWordCount(wordCountRef.current)
    if (role === 'examiner') {
      turnsRef.current += 1
      setTurns(turnsRef.current)
    }
  }, [])

  const startSession = useCallback(async () => {
    if (startedRef.current) return
    startedRef.current = true
    setErrorMsg('')
    setExamState('connecting')

    try {
      const session = await startRealtimeExam({
        candidateName: regRef.current.name,
        examType: params.exam,
        formId: params.formId,
        handlers: {
          onState: (s) => setExamState(s),
          onLatency: (ms) => setLatency(ms + 'ms'),
          onExaminerDelta: (text) => setLiveCaption(text),
          onExaminerFinal: (text) => {
            setLiveCaption('')
            pushTurn('examiner', text)
          },
          onCandidateFinal: (text) => pushTurn('candidate', text),
          onError: (message) => {
            setErrorMsg(message)
            setExamState('error')
            setRunning(false)
            stopTimer()
            startedRef.current = false
          },
        },
      })
      sessionRef.current = session
      questionRef.current = { id: session.questionId, formId: session.formId, title: session.questionTitle, examType: session.examType }
      // Arm the countdown from the case's configured duration.
      limitRef.current = Number(session.durationSeconds) > 0 ? Number(session.durationSeconds) : 480
      warnedRef.current = false
      setTimeUp(false)
      setRemaining(limitRef.current)
      setRunning(true)
      setMuted(false)
      startTimer()
    } catch (err) {
      setErrorMsg(err.message || 'Could not start the session.')
      setExamState(err.maintenance ? 'maintenance' : 'error')
      setRunning(false)
      startedRef.current = false
    }
  }, [pushTurn, startTimer])

  const toggleMute = useCallback(() => {
    if (!sessionRef.current) return
    const next = !muted
    setMuted(next)
    sessionRef.current.toggleMute(next)
  }, [muted])

  const endSession = useCallback(async () => {
    stopTimer()
    setRunning(false)
    setExamState('finishing')
    try {
      sessionRef.current?.stop()
    } catch { /* noop */ }
    sessionRef.current = null

    // Ask the backend for a full, detailed assessment of the transcript.
    let feedback = null
    try {
      const res = await fetch(apiUrl('/api/feedback'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: transcriptRef.current,
          examType: questionRef.current.examType || params.exam,
          questionId: questionRef.current.id,
          formId: questionRef.current.formId,
          durationSec: sessionSecRef.current,
          candidateName: regRef.current.name,
          candidateEmail: regRef.current.email,
          pathway: regRef.current.pathway,
        }),
      })
      if (res.ok) feedback = await res.json()
    } catch { /* fall back to null */ }

    setSessionData({
      durationSec:       sessionSecRef.current,
      questionsAnswered: turnsRef.current,
      wordCount:         wordCountRef.current,
      avgConfidence:     feedback?.score ?? 72,
      questionTitle:     questionRef.current.title || 'Clinical case',
      examType:          questionRef.current.examType || params.exam || 'General',
      candidateName:     regRef.current.name,
      candidateEmail:    regRef.current.email,
      pathway:           regRef.current.pathway,
      feedback,
      transcript:        transcriptRef.current,
      date:              new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }),
    })
    navigate('/report')
  }, [navigate, setSessionData])

  const onMicButton = useCallback(() => {
    if (examState === 'idle' || examState === 'error' || examState === 'maintenance') startSession()
    else if (running) toggleMute()
  }, [examState, running, startSession, toggleMute])

  // Keep refs in sync so the timer interval / async callbacks see fresh values.
  useEffect(() => { regRef.current = reg }, [reg])
  useEffect(() => { endRef.current = endSession }, [endSession])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer()
      try { sessionRef.current?.stop() } catch { /* noop */ }
    }
  }, [])

  const meta     = STATE_META[examState] || STATE_META.idle
  const timeStr  = fmtTime(sessionSec)
  const isActive = examState === 'listen' || examState === 'speak'
  const subText  = examState === 'speak' && liveCaption ? liveCaption : (errorMsg && (examState === 'error' || examState === 'maintenance') ? errorMsg : meta.sub)
  const lowTime  = running && remaining != null && remaining <= WARN_AT
  const countdownStr = remaining != null ? fmtTime(remaining) : fmtTime(limitRef.current)

  const submitRegistration = (e) => {
    e.preventDefault()
    if (!reg.name.trim()) return
    setRegistered(true)
  }

  return (
    <div
      className="va-bg"
      data-wt-anim={theme.design}
      style={{ '--wt-c1': theme.c1, '--wt-c2': theme.c2, '--wt-c3': theme.c3, '--c1': theme.c1, '--c2': theme.c2, '--c3': theme.c3 }}
    >
      <div className="va-theme-aura" aria-hidden="true">
        <span className="va-theme-aura__mid" />
      </div>

      {!registered && (
        <div className="va-reg-overlay">
          <form className="va-reg-card" onSubmit={submitRegistration}>
            <div className="va-reg-title">Before you begin</div>
            <div className="va-reg-sub">Register so your examiner report is saved to your name.</div>

            <label className="va-reg-label">Full name<span style={{ color: '#ef4444' }}> *</span></label>
            <input className="va-reg-input" value={reg.name} required placeholder="e.g. Dr Sarah Khan"
              onChange={(e) => setReg((r) => ({ ...r, name: e.target.value }))} />

            <label className="va-reg-label">Email</label>
            <input className="va-reg-input" type="email" value={reg.email} placeholder="you@example.com"
              onChange={(e) => setReg((r) => ({ ...r, email: e.target.value }))} />

            <label className="va-reg-label">Exam pathway</label>
            <select className="va-reg-input" value={reg.pathway}
              onChange={(e) => setReg((r) => ({ ...r, pathway: e.target.value }))}>
              <option value="">Select a pathway…</option>
              {PATHWAYS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>

            <button className="va-reg-btn" type="submit" disabled={!reg.name.trim()}>Start exam →</button>
          </form>
        </div>
      )}

      <div className={`va-card state-${examState}`} style={{ filter: registered ? 'none' : 'blur(4px)', pointerEvents: registered ? 'auto' : 'none' }}>

        {/* Header */}
        <div className="va-header">
          <div className="va-header-left">
            <div className="va-avatar">GP</div>
            <div>
              <div className="va-header-name">PassGP Examiner</div>
              <div className="va-header-status">
                <span className="va-status-dot" />
                {running ? (muted ? 'Mic muted' : 'Session active') : examState === 'connecting' ? 'Connecting' : 'Online'}
              </div>
            </div>
          </div>
          <div className={`va-header-time${lowTime ? ' va-header-time--low' : ''}`}>
            {running ? countdownStr : timeStr}
            {running && <span className="va-header-time-tag">left</span>}
          </div>
        </div>

        {lowTime && !timeUp && (
          <div className="va-time-warning">⚠ Less than a minute remaining — wrap up your answer.</div>
        )}
        {timeUp && (
          <div className="va-time-warning va-time-warning--up">⏱ Time is up — generating your report…</div>
        )}

        {/* Orb */}
        <div className="va-orb-section">
          <div className="va-orb-outer">
            <div className="va-atmo va-atmo-1" />
            <div className="va-atmo va-atmo-2" />
            <div className="va-atmo va-atmo-3" />
            <div className="va-orb-stage">
              {/* Live widget design — synced from the admin-selected template */}
              <WidgetDesign design={theme.design} />
            </div>
          </div>
        </div>

        {/* Status text */}
        <div className="va-status-section">
          <div className="va-status-label">{meta.label}</div>
          <div className="va-status-main">{meta.status}</div>
          <div className="va-status-sub">{subText}</div>
        </div>

        {/* Viz bars */}
        <div className={`va-viz${isActive ? ' active' : ''}`}>
          {BAR_HEIGHTS.map((h, i) => (
            <div key={i} className="va-vbar" style={{ '--i': i, '--h': h + 'px' }} />
          ))}
        </div>

        {/* Controls */}
        <div className="va-controls">
          <button className="va-btn-sm" title="End session & view report" onClick={endSession} disabled={!running && examState !== 'finishing'}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>

          <button
            className={`va-btn-main${running && !muted ? ' running' : ''}`}
            onClick={onMicButton}
            disabled={examState === 'connecting' || examState === 'finishing'}
            title={running ? (muted ? 'Unmute' : 'Mute') : 'Start'}
          >
            {running && muted ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
                <path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23" />
                <line x1="12" y1="19" x2="12" y2="23" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                <path d="M19 10v2a7 7 0 01-14 0v-2"/>
                <path d="M12 19v4m-4 0h8"/>
              </svg>
            )}
          </button>

          <button className="va-btn-sm" title="End & view report" onClick={endSession} disabled={!running && examState !== 'finishing'}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </button>
        </div>

        {/* Stats */}
        <div className="va-stats">
          <div className="va-stat"><div className="va-sv">{latency}</div><div className="va-sk">Latency</div></div>
          <div className="va-stat"><div className="va-sv">{timeStr}</div><div className="va-sk">Duration</div></div>
          <div className="va-stat"><div className="va-sv">{turns}</div><div className="va-sk">Questions</div></div>
          <div className="va-stat"><div className="va-sv">{wordCount}</div><div className="va-sk">Words</div></div>
        </div>

      </div>
    </div>
  )
}

function fmtTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0')
  const s = String(sec % 60).padStart(2, '0')
  return `${m}:${s}`
}
