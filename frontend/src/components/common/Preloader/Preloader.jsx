import { useEffect, useState } from 'react'
import { FaMicrophoneAlt } from 'react-icons/fa'
import './Preloader.css'

/**
 * Full-screen brand preloader shown on first paint.
 * Fades itself out after `duration` ms, then unmounts.
 */
export default function Preloader({ duration = 1400 }) {
  const [leaving, setLeaving] = useState(false)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), duration)
    const t2 = setTimeout(() => setGone(true), duration + 700)
    document.body.style.overflow = 'hidden'
    const tEnable = setTimeout(() => {
      document.body.style.overflow = ''
    }, duration)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(tEnable)
      document.body.style.overflow = ''
    }
  }, [duration])

  if (gone) return null

  return (
    <div className={`preloader ${leaving ? 'preloader--leaving' : ''}`}>
      <div className="preloader__inner">
        <div className="preloader__badge">
          <span className="preloader__ring" />
          <span className="preloader__ring preloader__ring--2" />
          <FaMicrophoneAlt className="preloader__icon" />
        </div>
        <div className="preloader__brand">
          Pass<span>GP</span>
        </div>
        <div className="preloader__bars" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </div>
        <p className="preloader__text">Warming up your AI examiner…</p>
      </div>
    </div>
  )
}
