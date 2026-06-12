import { useEffect, useState } from 'react'

/**
 * Tracks vertical scroll position and returns whether the page is
 * scrolled past a given threshold (default 40px). Throttled with rAF.
 */
export default function useScrollPosition(threshold = 40) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        setScrolled(window.scrollY > threshold)
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])

  return scrolled
}
