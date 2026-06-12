import { useEffect, useRef, useState } from 'react'
import './Reveal.css'

/**
 * Scroll-reveal wrapper. Fades + slides children into view once.
 * Props:
 *  - as: element/tag to render (default 'div')
 *  - delay: ms delay before the reveal transition starts
 *  - y: starting vertical offset in px
 *  - className: extra classes
 */
export default function Reveal({
  children,
  as: Tag = 'div',
  delay = 0,
  y = 30,
  className = '',
  ...rest
}) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.unobserve(el)
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <Tag
      ref={ref}
      className={`reveal ${visible ? 'is-visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms`, '--reveal-y': `${y}px` }}
      {...rest}
    >
      {children}
    </Tag>
  )
}
