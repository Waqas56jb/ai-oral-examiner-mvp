import { useRef, useEffect } from 'react'

const COLORS = {
  idle:   ['rgba(80,80,200,',   'rgba(130,130,255,', 'rgba(40,40,120,'],
  listen: ['rgba(5,150,100,',   'rgba(20,210,140,',  'rgba(0,80,50,'],
  think:  ['rgba(100,50,220,',  'rgba(160,110,255,', 'rgba(50,20,110,'],
  speak:  ['rgba(200,120,0,',   'rgba(250,170,30,',  'rgba(160,60,0,'],
}

const WAVE_TARGET = { idle: 0.05, listen: 0.9, think: 0.35, speak: 0.95 }

export default function OrbCanvas({ examState }) {
  const canvasRef = useRef(null)
  const stateRef  = useRef(examState)

  useEffect(() => { stateRef.current = examState }, [examState])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let t = 0
    let amp = 0
    let animId

    function draw() {
      const state  = stateRef.current
      const colors = COLORS[state] || COLORS.idle
      const target = WAVE_TARGET[state] ?? 0.05
      amp += (target - amp) * 0.04

      const W = 280, H = 280, cx = 140, cy = 140, R = 130
      ctx.clearRect(0, 0, W, H)

      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.clip()

      // Base sphere
      const baseGr = ctx.createRadialGradient(cx - 30, cy - 30, 0, cx, cy, R)
      baseGr.addColorStop(0,   colors[1] + '0.7)')
      baseGr.addColorStop(0.4, colors[0] + '0.5)')
      baseGr.addColorStop(0.8, colors[2] + '0.8)')
      baseGr.addColorStop(1,   'rgba(1,3,10,0.98)')
      ctx.fillStyle = baseGr
      ctx.fillRect(0, 0, W, H)

      // Plasma blobs
      for (let i = 0; i < 5; i++) {
        const angle = t * 0.3 + i * 1.26
        const r2    = 50 + 30 * Math.sin(t * 0.7 + i * 0.8)
        const bx    = cx + Math.cos(angle) * r2 * (0.6 + amp * 0.4)
        const by    = cy + Math.sin(angle * 1.3) * r2 * (0.6 + amp * 0.4)
        const brad  = 40 + 20 * Math.sin(t * 0.5 + i)
        const bg    = ctx.createRadialGradient(bx, by, 0, bx, by, brad)
        bg.addColorStop(0, colors[1] + (0.22 + amp * 0.22) + ')')
        bg.addColorStop(1, 'transparent')
        ctx.fillStyle = bg
        ctx.fillRect(0, 0, W, H)
      }

      // Energy flow lines
      for (let i = 0; i < 8; i++) {
        const a = t * 0.4 + i * 0.785
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        const ex  = cx + Math.cos(a) * R
        const ey  = cy + Math.sin(a) * R
        const cpx = cx + Math.cos(a + 0.5) * R * 0.6
        const cpy = cy + Math.sin(a + 0.5) * R * 0.6
        ctx.quadraticCurveTo(cpx, cpy, ex, ey)
        ctx.strokeStyle = colors[1] + (0.03 + amp * 0.06) + ')'
        ctx.lineWidth = 1
        ctx.stroke()
      }

      // Rim light
      const rimGr = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R)
      rimGr.addColorStop(0,    'transparent')
      rimGr.addColorStop(0.85, 'transparent')
      rimGr.addColorStop(1,    colors[1] + '0.3)')
      ctx.fillStyle = rimGr
      ctx.fillRect(0, 0, W, H)

      // Specular highlight
      const specGr = ctx.createRadialGradient(cx - 45, cy - 40, 0, cx - 45, cy - 40, 70)
      specGr.addColorStop(0,   'rgba(255,255,255,0.22)')
      specGr.addColorStop(0.4, 'rgba(255,255,255,0.06)')
      specGr.addColorStop(1,   'transparent')
      ctx.fillStyle = specGr
      ctx.fillRect(0, 0, W, H)

      ctx.restore()

      // Outer glow (outside clip)
      const outerGl = ctx.createRadialGradient(cx, cy, R * 0.88, cx, cy, R * 1.3)
      outerGl.addColorStop(0, colors[1] + (0.14 + amp * 0.14) + ')')
      outerGl.addColorStop(1, 'transparent')
      ctx.fillStyle = outerGl
      ctx.fillRect(0, 0, W, H)
    }

    function loop() {
      t += 0.016
      draw()
      animId = requestAnimationFrame(loop)
    }

    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={280}
      height={280}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        borderRadius: '50%',
      }}
    />
  )
}
