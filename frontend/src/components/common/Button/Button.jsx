import './Button.css'

/**
 * Reusable button / link button.
 * Props:
 *  - variant: 'primary' | 'secondary' | 'ghost' | 'light' | 'gold'
 *  - size: 'sm' | 'md' | 'lg'
 *  - as: 'button' | 'a' (default 'a' so it can be a CTA link)
 *  - icon: optional leading/trailing icon node
 *  - iconPosition: 'left' | 'right'
 *  - full: stretch to full width
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  as: Tag = 'a',
  icon = null,
  iconPosition = 'right',
  full = false,
  className = '',
  ...rest
}) {
  return (
    <Tag
      className={`btn btn--${variant} btn--${size} ${full ? 'btn--full' : ''} ${className}`}
      {...rest}
    >
      {icon && iconPosition === 'left' && <span className="btn__icon">{icon}</span>}
      <span className="btn__label">{children}</span>
      {icon && iconPosition === 'right' && <span className="btn__icon">{icon}</span>}
    </Tag>
  )
}
