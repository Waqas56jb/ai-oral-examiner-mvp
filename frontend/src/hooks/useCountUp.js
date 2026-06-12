import { useEffect, useRef, useState } from 'react'

/**
 * Counts from `start` to `end` once the element scrolls into view.
 * Returns [currentValue, ref] — attach ref to the element you want to observe.
 */
export default function useCountUp(end, { duration = 2000, start = 0 } = {}) {
  const [value, setValue] = useState(start)
  const ref = useRef(null)
  const hasRun = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || hasRun.current) return
        hasRun.current = true

        const startTime = performance.now()
        const animate = (now) => {
          const progress = Math.min((now - startTime) / duration, 1)
          const eased = 1 - Math.pow(1 - progress, 3) // easeOutCubic
          setValue(Math.floor(start + (end - start) * eased))
          if (progress < 1) requestAnimationFrame(animate)
          else setValue(end)
        }
        requestAnimationFrame(animate)
      },
      { threshold: 0.4 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [end, duration, start])

  return [value, ref]
}
