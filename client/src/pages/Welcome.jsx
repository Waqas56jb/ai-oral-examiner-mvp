import { useNavigate } from 'react-router-dom'
import './Welcome.css'

export default function Welcome() {
  const navigate = useNavigate()

  return (
    <div className="welcome-root">
      <div className="grain-overlay" />
      <div className="bracket tl" />
      <div className="bracket tr" />
      <div className="bracket bl" />
      <div className="bracket br" />

      <div className="welcome-card">
        {/* Logo / Brand */}
        <div className="welcome-brand">
          <div className="brand-dot" />
          <span className="brand-name">PASSGP</span>
          <span className="brand-tag">AI EXAMINER</span>
        </div>

        {/* Orb preview (static decorative) */}
        <div className="welcome-orb-wrap">
          <div className="w-atmo w-atmo-1" />
          <div className="w-atmo w-atmo-2" />
          <div className="w-atmo w-atmo-3" />
          <div className="w-orb-core">
            <div className="w-orb-scan" />
            <div className="w-orb-pulse" />
          </div>
        </div>

        {/* Title */}
        <div className="welcome-title">
          <h1>AI Oral Examiner</h1>
          <p className="welcome-subtitle">
            GP Fellowship Exam Preparation
          </p>
        </div>

        {/* Info list */}
        <ul className="welcome-info">
          <li>
            <span className="info-dot" />
            One clinical case — voice conversation with AI examiner
          </li>
          <li>
            <span className="info-dot" />
            Real-time voice interaction, no typing required
          </li>
          <li>
            <span className="info-dot" />
            Full transcript + performance report at the end
          </li>
        </ul>

        {/* CTA */}
        <button className="welcome-btn" onClick={() => navigate('/exam')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
            <path d="M19 10v2a7 7 0 01-14 0v-2" />
            <path d="M12 19v4m-4 0h8" />
          </svg>
          Begin Examination
        </button>

        <p className="welcome-footer">
          RACGP · ACRRM · AMC · PESCI &nbsp;·&nbsp; Secure &amp; Confidential
        </p>
      </div>
    </div>
  )
}
