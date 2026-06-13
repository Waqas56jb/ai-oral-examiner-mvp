import './widget-design.css'

/**
 * Renders the admin-selected voice-agent design (one of 10 distinct animations)
 * as the live widget orb. Colours come from CSS vars (--c1/--c2/--c3) set by the
 * parent (VoiceAgent applies the selected theme).
 */
export default function WidgetDesign({ design = 'cosmic' }) {
  return <div className={`wdg wdg--${design}`}>{render(design)}</div>
}

function render(design) {
  switch (design) {
    case 'bars':
      return (
        <div className="wd-bars">
          {Array.from({ length: 13 }).map((_, i) => (
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
      return <div className="wd-waves"><span /><span /><span /><span /></div>
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
          {Array.from({ length: 9 }).map((_, i) => (
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
