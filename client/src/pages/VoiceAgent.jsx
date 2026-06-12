import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import OrbCanvas from '../components/OrbCanvas'
import WaveRing from '../components/WaveRing'
import { useExam } from '../context/ExamContext'
import './VoiceAgent.css'

const CASES = [
  {
    q: 'Mrs Thompson, 52, presents with 3-week fatigue and exertional dyspnoea. How do you approach this?',
    a: 'I would take a focused history covering onset, associated symptoms such as chest pain or palpitations, PMH of cardiac or respiratory disease, then examine cardiovascular and respiratory systems. Initial investigations: FBC, TFTs, ECG and CXR.',
  },
  {
    q: 'A 67-year-old male with T2DM presents for annual review. HbA1c is 72 mmol/mol. Your plan?',
    a: 'Review medications and adherence, assess complications — renal function, retinopathy, foot exam. Reinforce lifestyle. Consider adding SGLT2 inhibitor or GLP-1 agonist if already on metformin.',
  },
  {
    q: '34-year-old woman, 6-month lower back pain. What red flags prompt urgent investigation?',
    a: 'Age under 20 or over 55, history of malignancy, unexplained weight loss, thoracic pain, night pain, progressive neurological deficit, saddle anaesthesia, bladder or bowel dysfunction.',
  },
  {
    q: '45-year-old newly diagnosed hypertension, reluctant to medicate. How do you counsel them?',
    a: 'Motivational interviewing approach — explore concerns, educate on target organ damage. Lifestyle first: sodium restriction, exercise, weight loss, alcohol reduction. Set a clear review date.',
  },
]

const BAR_HEIGHTS = [4,7,12,18,26,34,40,42,38,30,22,16,12,9,16,24,34,42,40,34,26,18,12,7,5,4,8,11]

const STATE_META = {
  idle:   { label: 'Ready to begin',   status: 'Tap to start',  sub: 'Your examiner is waiting' },
  listen: { label: 'Listening…',        status: 'Go ahead',      sub: 'Speak your answer clearly' },
  think:  { label: 'Thinking…',         status: 'Just a moment', sub: 'Processing your response' },
  speak:  { label: 'Examiner speaking', status: 'Listen',        sub: 'Feedback incoming' },
}

export default function VoiceAgent() {
  const navigate = useNavigate()
  const { setSessionData, examProgress, setExamProgress } = useExam()

  // Restore from saved progress if page was refreshed mid-session
  const saved = examProgress

  const [examState,   setExamState]   = useState('idle')
  const [running,     setRunning]     = useState(false)
  const [sessionSec,  setSessionSec]  = useState(saved?.sessionSec  ?? 0)
  const [wordCount,   setWordCount]   = useState(saved?.wordCount   ?? 0)
  const [confidence,  setConfidence]  = useState(saved?.confidence  ?? '—')
  const [latency,     setLatency]     = useState('—')
  const [restored,    setRestored]    = useState(!!saved)

  const runningRef      = useRef(false)
  const cycleIdxRef     = useRef(saved?.cycleIdx    ?? 0)
  const sessionTimerRef = useRef(null)
  const cycleTimerRef   = useRef(null)
  const sessionSecRef   = useRef(saved?.sessionSec  ?? 0)
  const wordCountRef    = useRef(saved?.wordCount   ?? 0)
  const confidenceArr   = useRef(saved?.confidenceArr ?? [])
  const transcriptRef   = useRef(saved?.transcript   ?? [])

  /* Save progress snapshot every time a cycle completes */
  const saveProgress = useCallback(() => {
    setExamProgress({
      sessionSec:    sessionSecRef.current,
      wordCount:     wordCountRef.current,
      cycleIdx:      cycleIdxRef.current,
      confidence:    confidenceArr.current.length
        ? Math.round(confidenceArr.current.reduce((a,b)=>a+b,0) / confidenceArr.current.length) + '%'
        : '—',
      confidenceArr: confidenceArr.current,
      transcript:    transcriptRef.current,
    })
  }, [setExamProgress])

  const startTimer = useCallback(() => {
    clearInterval(sessionTimerRef.current)
    sessionTimerRef.current = setInterval(() => {
      sessionSecRef.current += 1
      setSessionSec(sessionSecRef.current)
    }, 1000)
  }, [])

  const runCycle = useCallback(() => {
    if (!runningRef.current) return
    const idx  = cycleIdxRef.current
    const cas  = CASES[idx % CASES.length]
    const conf = Math.floor(88 + Math.random() * 12)
    confidenceArr.current.push(conf)

    setExamState('listen')
    setLatency(Math.floor(15 + Math.random() * 20) + 'ms')
    setConfidence(conf + '%')

    const w1 = wordCountRef.current + cas.q.split(' ').length
    wordCountRef.current = w1
    setWordCount(w1)
    transcriptRef.current.push({ role: 'examiner', text: cas.q, time: fmtTime(sessionSecRef.current) })
    saveProgress()

    cycleTimerRef.current = setTimeout(() => {
      if (!runningRef.current) return
      setExamState('think')
      setLatency(Math.floor(60 + Math.random() * 80) + 'ms')

      cycleTimerRef.current = setTimeout(() => {
        if (!runningRef.current) return
        setExamState('speak')
        setLatency(Math.floor(18 + Math.random() * 22) + 'ms')

        const w2 = wordCountRef.current + cas.a.split(' ').length
        wordCountRef.current = w2
        setWordCount(w2)
        transcriptRef.current.push({ role: 'candidate', text: cas.a, time: fmtTime(sessionSecRef.current) })
        cycleIdxRef.current = idx + 1
        saveProgress()

        cycleTimerRef.current = setTimeout(() => {
          if (!runningRef.current) return
          runCycle()
        }, 3500 + Math.random() * 1500)
      }, 1000 + Math.random() * 600)
    }, 2500 + Math.random() * 1500)
  }, [saveProgress])

  const startSession = useCallback((resume = false) => {
    if (!resume) {
      cycleIdxRef.current   = 0
      sessionSecRef.current = 0
      wordCountRef.current  = 0
      confidenceArr.current = []
      transcriptRef.current = []
      setSessionSec(0); setWordCount(0); setConfidence('—')
    }
    runningRef.current = true
    setRunning(true)
    setRestored(false)
    startTimer()
    runCycle()
  }, [startTimer, runCycle])

  const pauseSession = useCallback(() => {
    runningRef.current = false
    setRunning(false)
    clearTimeout(cycleTimerRef.current)
    clearInterval(sessionTimerRef.current)
    setExamState('idle')
    saveProgress()
  }, [saveProgress])

  const endSession = useCallback(() => {
    runningRef.current = false
    setRunning(false)
    clearTimeout(cycleTimerRef.current)
    clearInterval(sessionTimerRef.current)
    setExamState('idle')

    const avgConf = confidenceArr.current.length
      ? Math.round(confidenceArr.current.reduce((a, b) => a + b, 0) / confidenceArr.current.length)
      : 0

    setSessionData({
      durationSec:       sessionSecRef.current,
      questionsAnswered: cycleIdxRef.current,
      wordCount:         wordCountRef.current,
      avgConfidence:     avgConf,
      transcript:        transcriptRef.current,
      date:              new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }),
    })
    navigate('/report')
  }, [navigate, setSessionData])

  const toggleMic = useCallback(() => {
    if (running) pauseSession(); else startSession()
  }, [running, startSession, pauseSession])

  /* On mount: if we have saved progress, wait for user action (restored banner).
     Otherwise auto-start fresh after 900ms. */
  useEffect(() => {
    if (!saved) {
      const t = setTimeout(() => startSession(), 900)
      return () => clearTimeout(t)
    }
    // If there was saved progress, the user sees a "Resume" banner — no auto-start
    return () => {
      clearTimeout(cycleTimerRef.current)
      clearInterval(sessionTimerRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const meta     = STATE_META[examState] || STATE_META.idle
  const timeStr  = fmtTime(sessionSec)
  const isActive = examState === 'listen' || examState === 'speak'

  return (
    <div className="va-bg">
      <div className={`va-card state-${examState}`}>

        {/* Restore banner — only shown after page refresh with saved progress */}
        {restored && (
          <div className="va-restore-banner">
            <div className="va-restore-text">
              <span className="va-restore-icon">↩</span>
              Session restored — {fmtTime(sessionSec)} elapsed
            </div>
            <div className="va-restore-actions">
              <button className="va-restore-btn va-restore-resume" onClick={() => startSession(true)}>
                Resume
              </button>
              <button className="va-restore-btn va-restore-new" onClick={() => { setRestored(false); startSession(false) }}>
                New
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="va-header">
          <div className="va-header-left">
            <div className="va-avatar">GP</div>
            <div>
              <div className="va-header-name">PassGP Examiner</div>
              <div className="va-header-status">
                <span className="va-status-dot" />
                {running ? 'Session active' : 'Online'}
              </div>
            </div>
          </div>
          <div className="va-header-time">{timeStr}</div>
        </div>

        {/* Orb */}
        <div className="va-orb-section">
          <div className="va-orb-outer">
            <div className="va-atmo va-atmo-1" />
            <div className="va-atmo va-atmo-2" />
            <div className="va-atmo va-atmo-3" />
            <div className="va-orb-stage">
              <OrbCanvas examState={examState} />
              <WaveRing  examState={examState} />
              <div className="va-glass-core">
                <div className="va-core-scan" />
                <div className="va-core-pulse" />
              </div>
            </div>
          </div>
        </div>

        {/* Status text */}
        <div className="va-status-section">
          <div className="va-status-label">{meta.label}</div>
          <div className="va-status-main">{meta.status}</div>
          <div className="va-status-sub">{meta.sub}</div>
        </div>

        {/* Viz bars */}
        <div className={`va-viz${isActive ? ' active' : ''}`}>
          {BAR_HEIGHTS.map((h, i) => (
            <div key={i} className="va-vbar" style={{ '--i': i, '--h': h + 'px' }} />
          ))}
        </div>

        {/* Controls */}
        <div className="va-controls">
          <button className="va-btn-sm" title="End session & view report" onClick={endSession}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>

          <button className={`va-btn-main${running ? ' running' : ''}`} onClick={toggleMic} title={running ? 'Pause' : 'Start'}>
            {running ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1.5"/>
                <rect x="14" y="4" width="4" height="16" rx="1.5"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                <path d="M19 10v2a7 7 0 01-14 0v-2"/>
                <path d="M12 19v4m-4 0h8"/>
              </svg>
            )}
          </button>

          <button className="va-btn-sm" title="End & view report" onClick={endSession}>
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
          <div className="va-stat"><div className="va-sv">{confidence}</div><div className="va-sk">Confidence</div></div>
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
