import { useRef, useEffect } from 'react'

const STROKE = {
  idle:   ['rgba(0,229,255,0.35)',   'rgba(0,229,255,0.12)'],
  listen: ['rgba(0,255,170,0.4)',    'rgba(0,255,170,0.12)'],
  think:  ['rgba(191,96,255,0.4)',   'rgba(191,96,255,0.12)'],
  speak:  ['rgba(255,130,50,0.45)',  'rgba(255,130,50,0.12)'],
}

const AMP_TARGET = { idle: 0, listen: 1, think: 0.3, speak: 1 }

export default function WaveRing({ examState }) {
  const path1Ref = useRef(null)
  const path2Ref = useRef(null)
  const stateRef = useRef(examState)

  useEffect(() => { stateRef.current = examState }, [examState])

  useEffect(() => {
    let t = 0
    let amp = 0
    let animId

    function buildPath(t, amp, shrink = 0) {
      const cx = 140, cy = 140, R = 140 - shrink
      const pts = 64
      let d = ''
      for (let i = 0; i <= pts; i++) {
        const a     = (i / pts) * Math.PI * 2
        const wave1 = Math.sin(a * 4 + t * 2)   * amp * 8
        const wave2 = Math.sin(a * 6 - t * 1.5) * amp * 5
        const wave3 = Math.sin(a * 2 + t * 0.8) * amp * 4
        const r     = R + wave1 + wave2 + wave3
        const x     = cx + Math.cos(a) * r
        const y     = cy + Math.sin(a) * r
        d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1)
      }
      return d + 'Z'
    }

    function loop() {
      t += 0.016
      const state  = stateRef.current
      const target = AMP_TARGET[state] ?? 0
      amp += (target - amp) * 0.04

      const strokes = STROKE[state] || STROKE.idle

      if (path1Ref.current) {
        path1Ref.current.setAttribute('d', buildPath(t, amp, 0))
        path1Ref.current.setAttribute('stroke', strokes[0])
      }
      if (path2Ref.current) {
        path2Ref.current.setAttribute('d', buildPath(t, amp * 0.6, 10))
        path2Ref.current.setAttribute('stroke', strokes[1])
      }

      animId = requestAnimationFrame(loop)
    }

    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [])

  return (
    <svg
      viewBox="0 0 280 280"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      <path ref={path1Ref} fill="none" strokeWidth="1.5" />
      <path ref={path2Ref} fill="none" strokeWidth="1" />
    </svg>
  )
}
