import { useInView, useReducedMotion } from 'motion/react'
import { useRef, type CSSProperties, type ReactNode } from 'react'

/**
 * Out-of-focus pool floaties around the edges of the hero: big and soft when close to the "camera", small and
 * sharper further away, each with a shadow on the pool floor. The blur is baked into each SVG so the browser
 * rasterises it once; the gentle bob is a transform-only CSS animation that stops when the hero is offscreen.
 */

interface Floaty {
  art: (blur: number) => ReactNode
  blur: number
  style: CSSProperties
  className?: string
  duration: number
  delay: number
}

const FLOATIES: Floaty[] = [
  { art: (b) => <SwimRing colors={['#ff6fae', '#fff5f8']} blur={b} />, blur: 3.2, duration: 17, delay: -3, style: { left: '-4%', top: '60%', width: 'clamp(150px, 19vw, 280px)', opacity: 0.9 } },
  { art: (b) => <BeachBall blur={b} />, blur: 2.4, duration: 21, delay: -9, style: { right: '-3%', top: '9%', width: 'clamp(110px, 13vw, 200px)', opacity: 0.85 } },
  { art: (b) => <SwimRing colors={['#ffd23f', '#ffe98a']} blur={b} />, blur: 0.6, duration: 14, delay: -5, style: { left: '11%', top: '15%', width: 'clamp(54px, 6vw, 92px)', opacity: 0.7 }, className: 'max-md:hidden' },
  { art: (b) => <BeachBall blur={b} />, blur: 0.7, duration: 19, delay: -12, style: { right: '13%', top: '72%', width: 'clamp(40px, 4.4vw, 66px)', opacity: 0.6 }, className: 'max-md:hidden' },
]

export function Floaties() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref)
  const reduced = useReducedMotion()
  if (reduced) return null
  return (
    <div ref={ref} aria-hidden className={`floaties pointer-events-none absolute inset-0 overflow-hidden ${inView ? '' : 'floaties-paused'}`}>
      {FLOATIES.map((f, i) => (
        <div key={i} className={`floaty absolute ${f.className ?? ''}`} style={{ ...f.style, animationDuration: `${f.duration}s`, animationDelay: `${f.delay}s` }}>
          {f.art(f.blur)}
        </div>
      ))}
    </div>
  )
}

/** Shared filter defs: object blur plus a wider, offset shadow cast on the pool floor. */
function Defs({ id, blur }: { id: string; blur: number }) {
  return (
    <defs>
      <filter id={`${id}-b`} x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation={blur} />
      </filter>
      <filter id={`${id}-s`} x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation={blur + 3} />
      </filter>
    </defs>
  )
}

function SwimRing({ colors: [a, b], blur }: { colors: [string, string]; blur: number }) {
  const id = `ring-${a.slice(1)}-${Math.round(blur * 10)}`
  return (
    <svg viewBox="0 0 100 100" className="block h-auto w-full overflow-visible">
      <Defs id={id} blur={blur} />
      <ellipse cx="60" cy="68" rx="34" ry="30" fill="none" stroke="rgb(0 20 30 / 0.35)" strokeWidth="14" filter={`url(#${id}-s)`} />
      <g filter={`url(#${id}-b)`}>
        <circle cx="50" cy="50" r="30" fill="none" stroke={b} strokeWidth="18" />
        <circle cx="50" cy="50" r="30" fill="none" stroke={a} strokeWidth="18" strokeDasharray="23.56 23.56" transform="rotate(20 50 50)" />
        <circle cx="50" cy="50" r="38.5" fill="none" stroke="rgb(0 0 0 / 0.14)" strokeWidth="1.5" />
        <circle cx="50" cy="50" r="21.5" fill="none" stroke="rgb(0 0 0 / 0.16)" strokeWidth="1.5" />
        <path d="M27 33a30 30 0 0 1 20-13" fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth="5" strokeLinecap="round" />
      </g>
    </svg>
  )
}

function BeachBall({ blur }: { blur: number }) {
  const id = `ball-${Math.round(blur * 10)}`
  const p = (a: number) => `${50 + 36 * Math.cos(a)} ${50 + 36 * Math.sin(a)}`
  return (
    <svg viewBox="0 0 100 100" className="block h-auto w-full overflow-visible">
      <Defs id={id} blur={blur} />
      <defs>
        <radialGradient id={`${id}-shade`} cx=".35" cy=".3" r=".75">
          <stop offset=".5" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".28" />
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="66" rx="34" ry="30" fill="rgb(0 20 30 / 0.3)" filter={`url(#${id}-s)`} />
      <g filter={`url(#${id}-b)`}>
        <circle cx="50" cy="50" r="36" fill="#fff" />
        {['#ef4444', '#fbbf24', '#3b82f6', '#22c55e', '#f97316', '#06b6d4'].map((c, i) => {
          const a0 = (i / 6) * Math.PI * 2
          return <path key={c} d={`M50 50L${p(a0)}A36 36 0 0 1 ${p(a0 + Math.PI / 6)}Z`} fill={c} />
        })}
        <circle cx="50" cy="50" r="7" fill="#fff" />
        <circle cx="50" cy="50" r="36" fill={`url(#${id}-shade)`} />
        <ellipse cx="37" cy="31" rx="10" ry="6" fill="#fff" opacity=".6" transform="rotate(-35 37 31)" />
      </g>
    </svg>
  )
}
