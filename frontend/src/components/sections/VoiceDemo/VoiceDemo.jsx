import { useState } from 'react'
import { FaMicrophoneAlt } from 'react-icons/fa'
import { FiPlay, FiPause, FiUser } from 'react-icons/fi'
import Reveal from '../../common/Reveal/Reveal'
import Button from '../../common/Button/Button'
import './VoiceDemo.css'

const conversation = [
  { from: 'ai', text: 'Good morning. A 54-year-old man presents with central chest pain. How would you begin?' },
  { from: 'user', text: 'I’d take a focused history — onset, character, radiation — and check his vitals immediately.' },
  { from: 'ai', text: 'Good. His ECG shows ST elevation. What is your immediate management?' },
  { from: 'user', text: 'Activate the STEMI pathway, aspirin, and arrange urgent PCI.' },
]

export default function VoiceDemo() {
  const [playing, setPlaying] = useState(false)

  return (
    <section className="section section--navy demo" id="demo">
      <div className="demo__bg" aria-hidden="true">
        <span className="demo__blob" />
      </div>

      <div className="container demo__inner">
        {/* Copy */}
        <Reveal className="demo__copy">
          <span className="eyebrow">Live experience</span>
          <h2 className="demo__title">
            Hear what a session with your <span className="gradient-text">AI examiner</span> feels like
          </h2>
          <p className="demo__lead">
            This is a spoken, back-and-forth conversation — not a quiz. The examiner
            reacts to your answers, probes deeper, and keeps the pressure realistic,
            all powered by the OpenAI Realtime API over low-latency WebRTC audio.
          </p>

          <ul className="demo__points">
            <li><span /> Natural, interruptible two-way voice</li>
            <li><span /> Follow-up questions based on your answers</li>
            <li><span /> Full transcript captured automatically</li>
          </ul>

          <Button as="a" href="#pricing" variant="light" size="lg">
            Get early access
          </Button>
        </Reveal>

        {/* Mock player */}
        <Reveal className="demo__player" delay={150}>
          <div className="demo__player-head">
            <div className="demo__player-id">
              <span className="demo__player-badge">
                <FaMicrophoneAlt />
              </span>
              <div>
                <strong>RACGP · Cardiology case</strong>
                <small>Oral examiner session</small>
              </div>
            </div>
            <span className={`demo__status ${playing ? 'is-live' : ''}`}>
              {playing ? 'Live' : 'Ready'}
            </span>
          </div>

          <div className="demo__chat">
            {conversation.map((msg, i) => (
              <div key={i} className={`demo__msg demo__msg--${msg.from}`}>
                <span className="demo__msg-avatar">
                  {msg.from === 'ai' ? <FaMicrophoneAlt /> : <FiUser />}
                </span>
                <p>{msg.text}</p>
              </div>
            ))}
          </div>

          <div className="demo__controls">
            <button
              className={`demo__play ${playing ? 'is-playing' : ''}`}
              onClick={() => setPlaying((v) => !v)}
              aria-label={playing ? 'Pause demo' : 'Play demo'}
            >
              {playing ? <FiPause /> : <FiPlay />}
            </button>
            <div className={`demo__wave ${playing ? 'is-active' : ''}`} aria-hidden="true">
              {Array.from({ length: 28 }).map((_, i) => (
                <span key={i} style={{ animationDelay: `${i * 0.05}s` }} />
              ))}
            </div>
            <span className="demo__time">02:14</span>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
