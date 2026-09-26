import { useEffect, useRef } from 'react'

/**
 * Decorative molecular-network backdrop drawn on an HTML5 canvas: a sparse
 * field of nodes that drift slowly, joined by faint edges when close.
 * Respects prefers-reduced-motion (renders a single static frame).
 */
export default function NetworkCanvas({ density = 1, className = 'network-canvas' }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let nodes = []
    let w = 0
    let h = 0
    let dpr = 1
    let running = true

    const ink = 'rgba(26, 23, 21, '
    const accent = 'rgba(110, 27, 34, '

    function seed() {
      const count = Math.round(((w * h) / 26000) * density)
      nodes = Array.from({ length: count }, (_, i) => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        r: 1.2 + Math.random() * 1.6,
        accent: i % 9 === 0,
        phase: Math.random() * Math.PI * 2,
      }))
    }

    function resize() {
      const rect = canvas.getBoundingClientRect()
      dpr = Math.min(2, window.devicePixelRatio || 1)
      w = rect.width
      h = rect.height
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      seed()
      draw(0)
    }

    function draw(t) {
      ctx.clearRect(0, 0, w, h)
      const maxD = 120
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const d = Math.hypot(dx, dy)
          if (d < maxD) {
            const alpha = (1 - d / maxD) * 0.16
            ctx.strokeStyle = ink + alpha + ')'
            ctx.lineWidth = 0.7
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }
      }
      for (const n of nodes) {
        const pulse = n.accent ? 0.75 + 0.25 * Math.sin(t / 900 + n.phase) : 1
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r * (n.accent ? 1.3 : 1), 0, Math.PI * 2)
        ctx.fillStyle = n.accent ? accent + 0.55 * pulse + ')' : ink + 0.28 + ')'
        ctx.fill()
        if (n.accent) {
          ctx.beginPath()
          ctx.arc(n.x, n.y, n.r * 3.2, 0, Math.PI * 2)
          ctx.fillStyle = accent + 0.08 * pulse + ')'
          ctx.fill()
        }
      }
    }

    function step(t) {
      if (!running) return
      for (const n of nodes) {
        n.x += n.vx
        n.y += n.vy
        if (n.x < -10) n.x = w + 10
        if (n.x > w + 10) n.x = -10
        if (n.y < -10) n.y = h + 10
        if (n.y > h + 10) n.y = -10
      }
      draw(t)
      raf = requestAnimationFrame(step)
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()
    if (!reduce) raf = requestAnimationFrame(step)

    const onVis = () => {
      if (document.hidden) {
        running = false
        cancelAnimationFrame(raf)
      } else if (!reduce) {
        running = true
        raf = requestAnimationFrame(step)
      }
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [density])

  return <canvas ref={ref} className={className} aria-hidden="true" />
}
