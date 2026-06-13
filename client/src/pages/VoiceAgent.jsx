import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import OrbCanvas from '../components/OrbCanvas'
import WaveRing from '../components/WaveRing'
import { useExam } from '../context/ExamContext'
import { startRealtimeExam } from '../services/realtimeClient'
import { apiUrl } from '../services/config'
import './VoiceAgent.css'

const EXAM_TYPE = 'RACGP'

const BAR_HEIGHTS = [4,7,12,18,26,34,40,42,38,30,22,16,12,9,16,24,34,42,40,34,26,18,12,7,5,4,8,11]

const STATE_META = {
  idle:       { label: 'Ready to begin',    status: 'Tap to start',   sub: 'Your examiner is waiting' },
  connecting: { label: 'Connecting…',        status: 'One moment',     sub: 'Setting up your secure voice session' },
  listen:     { label: 'Listening…',         status: 'Go ahead',       sub: 'Speak your answer clearly' },
  think:      { label: 'Thinking…',          status: 'Just a moment',  sub: 'The examiner is considering your answer' },
  speak:      { label: 'Examiner speaking',  status: 'Listen',         sub: 'The examiner is responding' },
  finishing:  { label: 'Wrapping up…',        status: 'Almost done',    sub: 'Generating your feedback report' },
  error:      { label: 'Connection issue',    status: 'Tap to retry',   sub: 'We couldn’t reach the examiner' },
}

// OrbCanvas / WaveRing only know idle|listen|think|speak — map the rest.
const orbStateFor = (s) =>
  s === 'connecting' || s === 'finishing' ? 'think' : s === 'error' ? 'idle' : s

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
      questionRef.current = { id: session.questionId, formId: session.formId, title: session.questionTitle }
      setRunning(true)
      setMuted(false)
      startTimer()
    } catch (err) {
      setErrorMsg(err.message || 'Could not start the session.')
      setExamState('error')
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
          examType: params.exam,
          questionId: questionRef.current.id,
          formId: questionRef.current.formId,
          durationSec: sessionSecRef.current,
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
      examType:          params.exam,
      feedback,
      transcript:        transcriptRef.current,
      date:              new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }),
    })
    navigate('/report')
  }, [navigate, setSessionData])

  const onMicButton = useCallback(() => {
    if (examState === 'idle' || examState === 'error') startSession()
    else if (running) toggleMute()
  }, [examState, running, startSession, toggleMute])

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
  const subText  = examState === 'speak' && liveCaption ? liveCaption : (errorMsg && examState === 'error' ? errorMsg : meta.sub)

  return (
    <div className="va-bg">
      <div className={`va-card state-${examState}`}>

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
          <div className="va-header-time">{timeStr}</div>
        </div>

        {/* Orb */}
        <div className="va-orb-section">
          <div className="va-orb-outer">
            <div className="va-atmo va-atmo-1" />
            <div className="va-atmo va-atmo-2" />
            <div className="va-atmo va-atmo-3" />
            <div className="va-orb-stage">
              <OrbCanvas examState={orbStateFor(examState)} />
              <WaveRing  examState={orbStateFor(examState)} />
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
