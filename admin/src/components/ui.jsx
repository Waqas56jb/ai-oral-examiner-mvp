import { useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { FiX, FiSearch, FiInbox } from 'react-icons/fi'

/** Textarea that grows to fit its content (so long text is fully readable). */
export function AutoTextarea({ value, onChange, maxHeight = 420, minHeight = 90, ...rest }) {
  const ref = useRef(null)
  const resize = () => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.max(minHeight, Math.min(el.scrollHeight + 2, maxHeight)) + 'px'
  }
  useEffect(() => { resize() }) // re-size on every render (incl. when value loads)
  return (
    <textarea
      ref={ref}
      className="textarea"
      value={value}
      onChange={(e) => { onChange(e); resize() }}
      style={{ overflowY: 'auto', resize: 'vertical' }}
      {...rest}
    />
  )
}

export function Button({ children, variant = 'primary', size, icon, loading, className = '', ...rest }) {
  return (
    <button className={`btn btn--${variant} ${size ? 'btn--' + size : ''} ${className}`} disabled={loading || rest.disabled} {...rest}>
      {loading ? <span className="spinner" /> : icon}
      {children}
    </button>
  )
}

export function IconButton({ icon, danger, ...rest }) {
  return (
    <button className={`icon-btn ${danger ? 'icon-btn--danger' : ''}`} {...rest}>
      {icon}
    </button>
  )
}

export function Spinner({ ink }) {
  return <span className={`spinner ${ink ? 'spinner--ink' : ''}`} />
}

export function PageLoader() {
  return (
    <div className="loader-full">
      <div className="loader-dots">
        <span /><span /><span />
      </div>
    </div>
  )
}

export function Card({ title, sub, action, children, className = '', bodyClass = '' }) {
  return (
    <div className={`card ${className}`}>
      {(title || action) && (
        <div className="card__head">
          <div>
            {title && <div className="card__title">{title}</div>}
            {sub && <div className="card__sub">{sub}</div>}
          </div>
          {action}
        </div>
      )}
      <div className={`card__body ${bodyClass}`}>{children}</div>
    </div>
  )
}

export function StatCard({ icon, color = 'indigo', value, label, trend }) {
  return (
    <div className="stat">
      <div className="stat__bg" />
      <div className={`stat__icon stat__icon--${color}`}>{icon}</div>
      <div className="stat__value">{value}</div>
      <div className="stat__label">{label}</div>
      {trend && <div className={`stat__trend stat__trend--${trend.dir}`}>{trend.icon} {trend.text}</div>}
    </div>
  )
}

export function Badge({ children, color = 'gray', dot }) {
  return (
    <span className={`badge badge--${color}`}>
      {dot && <span className="badge__dot" />}
      {children}
    </span>
  )
}

export function Search({ value, onChange, placeholder = 'Search…' }) {
  return (
    <div className="search">
      <FiSearch />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}

export function EmptyState({ icon = <FiInbox />, title = 'Nothing here yet', text }) {
  return (
    <div className="empty">
      <div className="empty__icon">{icon}</div>
      <h3>{title}</h3>
      {text && <p className="muted">{text}</p>}
    </div>
  )
}

export function Modal({ title, onClose, children, footer, wide }) {
  // Lock background scroll while the modal is open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Render into <body> via a portal so position:fixed is relative to the
  // viewport (not a transformed ancestor) — the modal always opens centered
  // on screen, no matter how far the list is scrolled.
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal ${wide ? 'modal--wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3 style={{ fontSize: '1.15rem' }}>{title}</h3>
          <IconButton icon={<FiX />} onClick={onClose} />
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}

export function Field({ label, children }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
    </div>
  )
}
