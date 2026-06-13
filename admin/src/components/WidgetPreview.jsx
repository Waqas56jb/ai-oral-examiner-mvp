import { FiX, FiFileText, FiMic } from 'react-icons/fi'
import './widget-preview.css'

/**
 * Distinct animated voice-agent designs, themed by CSS variables.
 * Renders a different shape/animation per `theme.design`.
 */
export default function WidgetPreview({ theme, size = 130 }) {
  const style = { '--c1': theme.c1, '--c2': theme.c2, '--c3': theme.c3, '--wp-bg': theme.bg, width: size, height: size }
  return (
    <div className={`wp wp--${theme.design}`} style={style}>
      {render(theme.design)}
    </div>
  )
}

/**
 * Full, realistic preview of the live voice-agent widget as it appears
 * on the website / embedded iframe — themed by the selected template.
 */
export function WidgetMockup({ theme }) {
  const style = { '--c1': theme.c1, '--c2': theme.c2, '--c3': theme.c3, '--wp-bg': theme.bg }
  return (
    <div className="wmock" style={style}>
      <div className="wmock__head">
        <span className="wmock__avatar">GP</span>
        <div className="wmock__id">
          <div className="wmock__name">PassGP Examiner</div>
          <div className="wmock__online"><span className="wmock__dot" /> Online · AI Examiner</div>
        </div>
        <span className="wmock__time">00:07</span>
      </div>

      <div className="wmock__stage">
        <WidgetPreview theme={theme} size={196} />
      </div>

      <div className="wmock__status">
        <div className="wmock__status-label">Listening…</div>
        <div className="wmock__status-main">Go ahead</div>
        <div className="wmock__status-sub">Speak your answer clearly</div>
      </div>

      <div className="wmock__wave">
        {Array.from({ length: 26 }).map((_, i) => (
          <span key={i} style={{ animationDelay: `${i * 0.05}s` }} />
        ))}
      </div>

      <div className="wmock__controls">
        <button className="wmock__ctrl"><FiX /></button>
        <button className="wmock__ctrl wmock__ctrl--main"><FiMic /></button>
        <button className="wmock__ctrl"><FiFileText /></button>
      </div>

      <div className="wmock__stats">
        <div><b>23ms</b><span>Latency</span></div>
        <div><b>00:07</b><span>Duration</span></div>
        <div><b>98%</b><span>Confidence</span></div>
        <div><b>65</b><span>Words</span></div>
      </div>
    </div>
  )
}

function render(design) {
  switch (design) {
    case 'bars':
      return (
        <div className="wd-bars">
          {Array.from({ length: 11 }).map((_, i) => (
            <span key={i} style={{ animationDelay: `${i * 0.08}s` }} />
          ))}
        </div>
      )
    case 'radar':
      return (
        <div className="wd-radar">
          <span className="wd-radar__sweep" />
          <span className="wd-radar__ring" style={{ animationDelay: '0s' }} />
          <span className="wd-radar__ring" style={{ animationDelay: '0.8s' }} />
          <span className="wd-radar__ring" style={{ animationDelay: '1.6s' }} />
          <span className="wd-radar__core" />
        </div>
      )
    case 'blob':
      return <div className="wd-blob"><span /></div>
    case 'orbit':
      return (
        <div className="wd-orbit">
          <span className="wd-orbit__core" />
          <span className="wd-orbit__path p1"><i /></span>
          <span className="wd-orbit__path p2"><i /></span>
          <span className="wd-orbit__path p3"><i /></span>
        </div>
      )
    case 'disc':
      return <div className="wd-disc"><span className="wd-disc__face" /></div>
    case 'waves':
      return (
        <div className="wd-waves">
          <span /><span /><span /><span />
        </div>
      )
    case 'horizon':
      return (
        <div className="wd-horizon">
          <span className="wd-horizon__glow" />
          <span className="wd-horizon__sun" />
          <span className="wd-horizon__line" />
        </div>
      )
    case 'rain':
      return (
        <div className="wd-rain">
          {Array.from({ length: 7 }).map((_, i) => (
            <span key={i} style={{ animationDelay: `${(i % 4) * 0.4}s`, animationDuration: `${1.4 + (i % 3) * 0.4}s` }} />
          ))}
        </div>
      )
    case 'prism':
      return <div className="wd-prism"><span className="wd-prism__hex" /></div>
    case 'dot':
    default:
      return (
        <div className="wd-dot">
          <span className="wd-dot__pulse" />
          <span className="wd-dot__core" />
          <span className="wd-dot__eq"><i /><i /><i /></span>
        </div>
      )
  }
}
