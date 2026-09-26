/**
 * Celebration burst: a handful of translucent bubbles pop out of a point and wobble upwards, like a swimmer
 * exhaling. Drawn on a temporary full-screen canvas that removes itself when the last bubble fades.
 */
export function burstBubbles(x: number, y: number, { count = 34, hue = 174 } = {}) {
  if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: '9999' })
  canvas.width = innerWidth * dpr
  canvas.height = innerHeight * dpr
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)

  const bubbles = Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2
    const speed = 2 + Math.random() * 5
    return {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      r: 3 + Math.random() * 9,
      life: 0,
      max: 70 + Math.random() * 50,
      wobble: Math.random() * Math.PI * 2,
      h: hue + (Math.random() - 0.5) * 50,
    }
  })

  let frame = 0
  const tick = () => {
    ctx.clearRect(0, 0, innerWidth, innerHeight)
    let alive = 0
    for (const b of bubbles) {
      if (b.life > b.max) continue
      alive++
      b.life++
      b.vx *= 0.94
      b.vy = b.vy * 0.95 - 0.12 // buoyancy
      b.wobble += 0.18
      b.x += b.vx + Math.sin(b.wobble) * 0.6
      b.y += b.vy
      const t = b.life / b.max
      const alpha = t < 0.1 ? t * 10 : 1 - Math.pow(t, 3)
      const r = b.r * (0.6 + t * 0.5)
      ctx.beginPath()
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${b.h}, 85%, 65%, ${alpha * 0.18})`
      ctx.fill()
      ctx.lineWidth = 1.4
      ctx.strokeStyle = `hsla(${b.h}, 90%, 70%, ${alpha * 0.9})`
      ctx.stroke()
      // Specular highlight.
      ctx.beginPath()
      ctx.arc(b.x - r * 0.35, b.y - r * 0.35, r * 0.28, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(0, 0%, 100%, ${alpha * 0.8})`
      ctx.fill()
    }
    if (alive) frame = requestAnimationFrame(tick)
    else canvas.remove()
  }
  frame = requestAnimationFrame(tick)
  setTimeout(() => {
    cancelAnimationFrame(frame)
    canvas.remove()
  }, 4000)
}

/** Burst from the centre of an element. */
export function burstFrom(el: Element | null, opts?: Parameters<typeof burstBubbles>[2]) {
  if (!el) return
  const r = el.getBoundingClientRect()
  burstBubbles(r.left + r.width / 2, r.top + r.height / 2, opts)
}
