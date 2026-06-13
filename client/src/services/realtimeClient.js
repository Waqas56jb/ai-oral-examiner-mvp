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

export async function startRealtimeExam({ candidateName = '', examType = 'RACGP', handlers = {} } = {}) {
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
    body: JSON.stringify({ candidateName, examType }),
  })
  if (!tokenRes.ok) {
    const detail = await safeText(tokenRes)
    throw new Error(`Could not start session (${tokenRes.status}). Is the server running and OPENAI_API_KEY set? ${detail}`)
  }
  const session = await tokenRes.json()
  const ephemeralKey = session?.value || session?.client_secret?.value
  const model = session?.model
  const webrtcUrl = session?.webrtcUrl || FALLBACK_WEBRTC_URL
  if (!ephemeralKey || !model) {
    throw new Error('Server did not return a valid realtime session token.')
  }

  // 2) Peer connection
  const pc = new RTCPeerConnection()

  // Examiner audio playback
  const audioEl = new Audio()
  audioEl.autoplay = true
  pc.ontrack = (e) => {
    audioEl.srcObject = e.streams[0]
  }

  // Microphone capture
  let micStream
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
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

  pc.addEventListener('connectionstatechange', () => {
    if (['failed', 'disconnected'].includes(pc.connectionState)) {
      onError('The voice connection dropped. Please restart the session.')
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

  function cleanup() {
    try {
      micStream?.getTracks().forEach((t) => t.stop())
    } catch { /* noop */ }
    try {
      dc.close()
    } catch { /* noop */ }
    try {
      pc.close()
    } catch { /* noop */ }
    audioEl.srcObject = null
  }

  return {
    /** Mute / unmute the candidate's microphone. */
    toggleMute(muted) {
      micStream?.getAudioTracks().forEach((t) => (t.enabled = !muted))
    },
    /** Tear down the entire session. */
    stop: cleanup,
    questionId: session?.questionId || null,
    questionTitle: session?.questionTitle || null,
    examType: session?.examType || examType,
    pc,
    dc,
  }
}

function handleEvent(msg, h, state) {
  const type = msg.type || ''

  // Turn-taking / state
  if (type === 'input_audio_buffer.speech_started') {
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
    h.onState('think')
    return
  }

  // Examiner spoken transcript (assistant)
  if (type.endsWith('audio_transcript.delta')) {
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

  // Response finished → back to listening
  if (type === 'response.done') {
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
