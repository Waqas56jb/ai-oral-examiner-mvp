import './widget-preview.css'

/**
 * Animated 3D-style voice-agent orb preview, themed by CSS variables.
 * Used in the admin Settings template picker (and mirrors the live widget look).
 */
export default function WidgetPreview({ theme, size = 130, speaking = true }) {
  const style = {
    '--c1': theme.c1,
    '--c2': theme.c2,
    '--c3': theme.c3,
    '--wp-bg': theme.bg,
    width: size,
    height: size,
  }
  return (
    <div className={`wp wp--${theme.anim}`} style={style}>
      <span className="wp__halo" />
      <span className="wp__ring" />
      <span className="wp__ring wp__ring--2" />
      <span className="wp__orb">
        <span className="wp__orb-core" />
        <span className="wp__orb-scan" />
      </span>
      <span className={`wp__wave ${speaking ? 'is-on' : ''}`}>
        {Array.from({ length: 7 }).map((_, i) => (
          <span key={i} style={{ animationDelay: `${i * 0.09}s` }} />
        ))}
      </span>
    </div>
  )
}
