import { FiPlay, FiArrowRight, FiCheckCircle } from 'react-icons/fi'
import { FaMicrophoneAlt } from 'react-icons/fa'
import Button from '../../common/Button/Button'
import './Hero.css'

const HERO_IMG =
  'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=900&q=80'

const checklist = ['No setup required', 'Real exam pressure', 'Instant feedback']

export default function Hero() {
  return (
    <section className="hero" id="top">
      {/* Decorative background */}
      <div className="hero__bg" aria-hidden="true">
        <span className="hero__blob hero__blob--1" />
        <span className="hero__blob hero__blob--2" />
        <span className="hero__grid" />
      </div>

      <div className="container hero__inner">
        {/* Copy */}
        <div className="hero__copy">
          <span className="hero__badge">
            <span className="hero__badge-dot" />
            AI-Powered Medical Exam Preparation
          </span>

          <h1 className="hero__title">
            Master your oral exams with an{' '}
            <span className="gradient-text">AI examiner</span> that talks back
          </h1>

          <p className="hero__lead">
            PassGP lets you practise spoken medical exams in real time. Speak
            naturally, get questioned like the real thing, and receive an instant
            transcript and structured feedback — built for RACGP, ACRRM, AMC and
            PESCI candidates.
          </p>

          <ul className="hero__checklist">
            {checklist.map((item) => (
              <li key={item}>
                <FiCheckCircle /> {item}
              </li>
            ))}
          </ul>

          <div className="hero__actions">
            <Button as="a" href="#demo" variant="primary" size="lg" icon={<FiArrowRight />}>
              Try the live demo
            </Button>
            <Button as="a" href="#how-it-works" variant="secondary" size="lg" icon={<FiPlay />} iconPosition="left">
              See how it works
            </Button>
          </div>

          <div className="hero__proof">
            <div className="hero__avatars">
              <img src="https://randomuser.me/api/portraits/women/68.jpg" alt="" />
              <img src="https://randomuser.me/api/portraits/men/32.jpg" alt="" />
              <img src="https://randomuser.me/api/portraits/women/44.jpg" alt="" />
              <img src="https://randomuser.me/api/portraits/men/75.jpg" alt="" />
            </div>
            <p>
              Trusted by candidates preparing for <strong>postgraduate medical exams</strong>
            </p>
          </div>
        </div>

        {/* Visual */}
        <div className="hero__visual">
          <div className="hero__photo-wrap">
            <img
              src={HERO_IMG}
              alt="Medical candidate practising an oral exam"
              className="hero__photo"
              loading="eager"
            />
            <div className="hero__photo-overlay" />
          </div>

          {/* Floating mic / voice card */}
          <div className="hero__card hero__card--voice">
            <div className="hero__mic">
              <FaMicrophoneAlt />
              <span className="hero__mic-ring" />
            </div>
            <div className="hero__wave" aria-hidden="true">
              {Array.from({ length: 9 }).map((_, i) => (
                <span key={i} style={{ animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
            <span className="hero__card-label">Listening…</span>
          </div>

          {/* Floating transcript card */}
          <div className="hero__card hero__card--transcript">
            <div className="hero__chip">
              <span className="hero__chip-dot" /> Examiner
            </div>
            <p>“Walk me through your initial assessment of this patient.”</p>
          </div>

          {/* Floating score card */}
          <div className="hero__card hero__card--score">
            <div className="hero__score-circle">
              <svg viewBox="0 0 36 36">
                <path
                  className="hero__score-bg"
                  d="M18 2.5a15.5 15.5 0 1 1 0 31 15.5 15.5 0 0 1 0-31"
                />
                <path
                  className="hero__score-fg"
                  d="M18 2.5a15.5 15.5 0 1 1 0 31 15.5 15.5 0 0 1 0-31"
                />
              </svg>
              <span className="hero__score-num">86%</span>
            </div>
            <div>
              <strong>Feedback ready</strong>
              <small>Strong clinical reasoning</small>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
