/**
 * Real-time voice client for the PassGP examiner.
 *
 * Flow (secure):
 *   1. Ask our own server for a short-lived ephemeral token
 *      (the real OpenAI key stays on the server).
 *   2. Open a WebRTC peer connection straight to OpenAI Realtime using it.
 *   3. Stream mic audio up, play examiner audio down, and read events
 *      (transcripts, turn state) over the data channel.
 *
 * Usage:
 *   const session = await startRealtimeExam({ candidateName, examType, handlers })
 *   session.toggleMute(true)   // mute the mic
 *   session.stop()             // tear everything down
 */

import { apiUrl } from './config'

const SESSION_ENDPOINT = apiUrl('/api/realtime/session')
const FALLBACK_WEBRTC_URL = 'https://api.openai.com/v1/realtime/calls'

export async function startRealtimeExam({ candidateName = '', examType = 'RACGP', formId = null, handlers = {} } = {}) {
  const {
    onState = () => {},
    onLatency = () => {},
    onExaminerDelta = () => {},
    onExaminerFinal = () => {},
    onCandidateFinal = () => {},
    onError = () => {},
  } = handlers

  // 1) Ephemeral token from our backend
  const tokenRes = await fetch(SESSION_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidateName, examType, formId }),
  })
  if (!tokenRes.ok) {
    let msg = `Could not start the session (${tokenRes.status}).`
    let maintenance = false
    try {
      const j = await tokenRes.json()
      if (j?.error) msg = j.error
      if (j?.maintenance) maintenance = true
    } catch {
      /* keep default */
    }
    const e = new Error(msg)
    e.maintenance = maintenance
    throw e
  }
  const session = await tokenRes.json()
  const ephemeralKey = session?.value || session?.client_secret?.value
  const model = session?.model
  const webrtcUrl = session?.webrtcUrl || FALLBACK_WEBRTC_URL
  if (!ephemeralKey || !model) {
    throw new Error('Server did not return a valid realtime session token.')
  }

  // 2) Peer connection — STUN servers greatly improve connection reliability
  //    (NAT traversal) and reduce dropped/choppy audio.
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
    ],
    bundlePolicy: 'max-bundle',
  })

  // Examiner audio playback
  const audioEl = new Audio()
  audioEl.autoplay = true
  pc.ontrack = (e) => {
    audioEl.srcObject = e.streams[0]
  }

  // Microphone capture — echo cancellation stops the agent from hearing its own
  // voice through the speakers (the #1 cause of it interrupting itself).
  let micStream
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    })
  } catch {
    pc.close()
    throw new Error('Microphone access was blocked. Please allow the mic and try again.')
  }
  micStream.getTracks().forEach((track) => pc.addTrack(track, micStream))

  // Per-session transcript / timing state
  const state = {
    examinerBuf: '',
    thinkAt: 0,
    awaitingFirstAudio: false,
    assistantActive: false, // true while the examiner is thinking/speaking
  }

  // 3) Data channel for realtime events
  const dc = pc.createDataChannel('oai-events')

  dc.addEventListener('open', () => {
    onState('listen')
    // Ask the examiner to greet and ask the first question (no user input yet).
    dc.send(JSON.stringify({ type: 'response.create' }))
  })

  dc.addEventListener('message', (e) => {
    let msg
    try {
      msg = JSON.parse(e.data)
    } catch {
      return
    }
    handleEvent(msg, { onState, onLatency, onExaminerDelta, onExaminerFinal, onCandidateFinal, onError }, state)
  })

  // WebRTC briefly flips to "disconnected" on minor network/noise hiccups and
  // usually recovers on its own. Only surface a fatal error if it stays down.
  let dropTimer = null
  pc.addEventListener('connectionstatechange', () => {
    const st = pc.connectionState
    if (st === 'connected' || st === 'completed') {
      if (dropTimer) {
        clearTimeout(dropTimer)
        dropTimer = null
      }
      return
    }
    if ((st === 'disconnected' || st === 'failed') && !dropTimer) {
      dropTimer = setTimeout(() => {
        if (pc.connectionState !== 'connected' && pc.connectionState !== 'completed') {
          onError('The voice connection dropped. Please restart the session.')
        }
      }, st === 'failed' ? 6000 : 10000)
    }
  })

  // 4) SDP offer / answer handshake with OpenAI
  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)

  const sdpRes = await fetch(webrtcUrl, {
    method: 'POST',
    body: offer.sdp,
    headers: {
      Authorization: `Bearer ${ephemeralKey}`,
      'Content-Type': 'application/sdp',
    },
  })
  if (!sdpRes.ok) {
    const detail = await safeText(sdpRes)
    cleanup()
    throw new Error(`OpenAI realtime handshake failed (${sdpRes.status}). ${detail}`)
  }
  const answer = { type: 'answer', sdp: await sdpRes.text() }
  await pc.setRemoteDescription(answer)

  let stopped = false
  function cleanup() {
    if (stopped) return
    stopped = true
    if (dropTimer) {
      clearTimeout(dropTimer)
      dropTimer = null
    }
    // Tell the model to stop generating, then immediately silence playback.
    try {
      if (dc.readyState === 'open') dc.send(JSON.stringify({ type: 'response.cancel' }))
    } catch { /* noop */ }
    try {
      micStream?.getTracks().forEach((t) => t.stop())
    } catch { /* noop */ }
    // Stop the incoming examiner audio track(s)
    try {
      pc.getReceivers().forEach((r) => {
        try { r.track && r.track.stop() } catch { /* noop */ }
      })
    } catch { /* noop */ }
    try {
      dc.close()
    } catch { /* noop */ }
    try {
      pc.close()
    } catch { /* noop */ }
    // Hard-stop the audio element so buffered speech stops instantly
    try {
      audioEl.pause()
      audioEl.muted = true
      audioEl.srcObject = null
      audioEl.removeAttribute('src')
      audioEl.load()
    } catch { /* noop */ }
  }

  return {
    /** Mute / unmute the candidate's microphone. */
    toggleMute(muted) {
      micStream?.getAudioTracks().forEach((t) => (t.enabled = !muted))
    },
    /** Tear down the entire session. */
    stop: cleanup,
    questionId: session?.questionId || null,
    formId: session?.formId || formId || null,
    questionTitle: session?.questionTitle || null,
    examType: session?.examType || examType,
    durationSeconds: Number(session?.durationSeconds) > 0 ? Number(session.durationSeconds) : 480,
    pc,
    dc,
  }
}

function handleEvent(msg, h, state) {
  const type = msg.type || ''

  // Turn-taking. Barge-in is enabled: when the candidate starts speaking we
  // switch to listening even if the examiner was mid-sentence (echo cancellation
  // on the mic prevents the examiner's own voice from triggering this).
  if (type === 'input_audio_buffer.speech_started') {
    state.assistantActive = false
    h.onState('listen')
    return
  }
  if (type === 'input_audio_buffer.speech_stopped') {
    state.thinkAt = performance.now()
    state.awaitingFirstAudio = true
    h.onState('think')
    return
  }
  if (type === 'response.created') {
    state.assistantActive = true
    h.onState('think')
    return
  }

  // Examiner spoken transcript (assistant)
  if (type.endsWith('audio_transcript.delta')) {
    state.assistantActive = true
    state.examinerBuf += msg.delta || ''
    h.onState('speak')
    h.onExaminerDelta(state.examinerBuf)
    return
  }
  if (type.endsWith('audio_transcript.done')) {
    const text = (msg.transcript || state.examinerBuf || '').trim()
    if (text) h.onExaminerFinal(text)
    state.examinerBuf = ''
    return
  }

  // First chunk of examiner audio → measure latency, switch to speaking
  if (type === 'response.audio.delta' || type === 'response.output_audio.delta') {
    state.assistantActive = true
    if (state.awaitingFirstAudio && state.thinkAt) {
      h.onLatency(Math.round(performance.now() - state.thinkAt))
      state.awaitingFirstAudio = false
    }
    h.onState('speak')
    return
  }

  // Candidate's transcribed speech (user)
  if (type.includes('input_audio_transcription') && type.endsWith('completed')) {
    const text = (msg.transcript || '').trim()
    if (text) h.onCandidateFinal(text)
    return
  }

  // Response finished → it's now genuinely the candidate's turn
  if (type === 'response.done') {
    state.assistantActive = false
    h.onState('listen')
    return
  }

  if (type === 'error') {
    h.onError(msg.error?.message || 'The examiner hit an error. Please try again.')
  }
}

async function safeText(res) {
  try {
    return (await res.text()).slice(0, 300)
  } catch {
    return ''
  }
}
