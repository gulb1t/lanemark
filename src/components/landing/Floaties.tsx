import { useInView, useReducedMotion } from 'motion/react'
import { useId, useRef, useState, type CSSProperties } from 'react'

/**
 * Pool toys drifting in the hero water, out of focus: a few big ones close to the "camera" peeking in from the
 * edges, and smaller, hazier ones further down. They sit inside the water layer (under the same fog and vignette as
 * the caustics) and are blended into it, so the light plays across them. The layout, toys and colours are shuffled
 * on every load. Blur is baked into each SVG so it's rasterised once; the bob is a transform-only CSS animation that
 * stops when the hero is offscreen.
 */

type Kind = 'ring' | 'ball' | 'duck'
type Depth = 'near' | 'mid' | 'far'
type Side = 'left' | 'right'

interface Slot {
  side: Side
  /** Distance from that side, % of the hero width. */
  x: number
  /** % of the hero height. */
  y: number
}

interface Toy {
  kind: Kind
  depth: Depth
  slot: Slot
  scale: number
  rot: number
  palette: number
  duration: number
  delay: number
  flip: boolean
}

/** Positions are for the padded box, so the toy itself starts about 5% further in; these tuck a third of it offscreen. */
const NEAR: Slot[] = [
  { side: 'left', x: -13, y: 52 },
  { side: 'left', x: -12, y: 0 },
  { side: 'right', x: -12, y: -2 },
  { side: 'right', x: -14, y: 55 },
]
const MID: Slot[] = [
  { side: 'left', x: 9, y: 30 },
  { side: 'right', x: 10, y: 36 },
  { side: 'left', x: 15, y: 76 },
  { side: 'right', x: 13, y: 78 },
]
const FAR: Slot[] = [
  { side: 'left', x: 21, y: 13 },
  { side: 'right', x: 20, y: 15 },
  { side: 'left', x: 4, y: 42 },
  { side: 'right', x: 4, y: 31 },
  { side: 'right', x: 25, y: 70 },
  { side: 'left', x: 26, y: 86 },
]

const SIZE: Record<Depth, string> = {
  near: 'clamp(130px, 21vw, 320px)',
  mid: 'clamp(84px, 9vw, 140px)',
  far: 'clamp(40px, 4.4vw, 68px)',
}
const BLUR: Record<Depth, [number, number]> = { near: [3.4, 4.4], mid: [1.8, 2.4], far: [0.9, 1.3] }
const OPACITY: Record<Depth, number> = { near: 0.72, mid: 0.62, far: 0.5 }

/** Stripe colours; the other stripes use the theme's "white" (tinted by the pool light in dark mode). */
const RINGS = ['#ff5277', '#ffc23d', '#1fc9bd', '#ff8a3d']
const BALLS: string[][] = [
  ['#ff4f6d', '#ffc53d', '#2f8cff'],
  ['#ff7a45', '#1fc9bd', '#ffd23f'],
  ['#2f8cff', '#ff5fa2', '#8bd94a'],
]
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)]
const between = (a: number, b: number) => a + Math.random() * (b - a)
const quadrant = (s: Slot) => `${s.side}-${s.y < 50 ? 'top' : 'bottom'}`
const shuffle = <T,>(xs: T[]) => xs.map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x)

/**
 * One close ring on each side (rings keep their shape when this far out of focus; a ball turns into a blob), one toy
 * in the middle distance and two far away, never two in the same corner.
 */
function makeLayout(): Toy[] {
  const near = [pick(NEAR.filter((s) => s.side === 'left')), pick(NEAR.filter((s) => s.side === 'right'))]
  const taken = new Set(near.map(quadrant))
  const mid = shuffle(MID.filter((s) => !taken.has(quadrant(s))))[0]
  taken.add(quadrant(mid))
  const far = shuffle(FAR.filter((s) => !taken.has(quadrant(s)))).slice(0, 2)

  const palettes = shuffle([0, 1, 2, 3])
  const toy = (kind: Kind, depth: Depth, slot: Slot, i: number): Toy => ({
    kind,
    depth,
    slot,
    scale: between(0.88, 1.1),
    // Ducks stay upright and face either way; rings and balls can sit at any angle.
    rot: kind === 'duck' ? between(-12, 12) : between(0, 360),
    flip: Math.random() < 0.5,
    palette: palettes[i % palettes.length],
    duration: between(15, 23),
    delay: -between(0, 20),
  })
  return [
    toy('ring', 'near', near[0], 0),
    toy('ring', 'near', near[1], 1),
    toy(pick<Kind>(['ring', 'ball', 'duck']), 'mid', mid, 2),
    ...far.map((s, i) => toy(pick<Kind>(['duck', 'duck', 'ball', 'ring']), 'far', s, 3 + i)),
  ]
}

export function Floaties() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref)
  const reduced = useReducedMotion()
  const [toys] = useState(makeLayout)
  return (
    <div ref={ref} aria-hidden className={`floaties pointer-events-none absolute inset-0 ${inView && !reduced ? '' : 'floaties-paused'}`}>
      {toys.map((t, i) => {
        const style: CSSProperties = {
          [t.slot.side]: `${t.slot.x}%`,
          top: `${t.slot.y}%`,
          width: `calc(${SIZE[t.depth]} * ${(t.scale * PAD_SCALE).toFixed(2)})`,
          // --floaty-opacity scales everything per theme.
          opacity: `calc(var(--floaty-opacity, 1) * ${OPACITY[t.depth]})`,
          animationDuration: `${t.duration.toFixed(1)}s`,
          animationDelay: `${t.delay.toFixed(1)}s`,
        }
        return (
          <div key={i} className={`floaty absolute ${t.depth === 'near' ? '' : 'max-md:hidden'}`} style={style}>
            <div style={{ transform: `${t.flip ? 'scaleX(-1) ' : ''}rotate(${t.rot.toFixed(0)}deg)` }}>
              <Art toy={t} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Art({ toy }: { toy: Toy }) {
  const [lo, hi] = BLUR[toy.depth]
  const [blur] = useState(() => between(lo, hi))
  switch (toy.kind) {
    case 'ring':
      return <Ring blur={blur} tube={16} colors={[RINGS[toy.palette], WHITE]} />
    case 'duck':
      return <Duck blur={blur} />
    case 'ball':
      return <BeachBall blur={blur} colors={BALLS[toy.palette % BALLS.length]} />
  }
}

/** Object blur, plus a softer one for the shadow on the pool floor. */
function Filters({ id, blur }: { id: string; blur: number }) {
  return (
    <>
      <filter id={`${id}b`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation={blur} />
      </filter>
      <filter id={`${id}s`} x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation={blur + 2.5} />
      </filter>
    </>
  )
}

const SHADOW = 'rgb(4 58 70 / 0.3)'
const WHITE = 'var(--floaty-white)'
/** Each toy is drawn in 0–120 with room around it for the blur, which Chrome would otherwise crop at the SVG edge. */
const PAD = 30
const VIEWBOX = `${-PAD} ${-PAD} ${120 + PAD * 2} ${120 + PAD * 2}`
const PAD_SCALE = (120 + PAD * 2) / 120
const xy = (r: number, deg: number) => [60 + r * Math.cos((deg * Math.PI) / 180), 60 + r * Math.sin((deg * Math.PI) / 180)] as const
const polar = (r: number, deg: number) => xy(r, deg).map((v) => v.toFixed(2)).join(' ')

/** An inflatable ring (or a small solid dive ring): a torus lit from the top left. */
function Ring({ blur, tube, colors: [a, b] }: { blur: number; tube: number; colors: [string, string] }) {
  const id = useId().replace(/:/g, '')
  const R = 38
  const inner = R - tube
  const outer = R + tube
  const C = 2 * Math.PI * R
  const striped = a !== b
  const band = { cx: 60, cy: 60, r: R, fill: 'none', strokeWidth: tube * 2 }
  const at = (f: number) => (inner + tube * 2 * f) / outer
  return (
    <svg viewBox={VIEWBOX} className="block h-auto w-full">
      <defs>
        <Filters id={id} blur={blur} />
        {/* Across the tube: dark inner edge, a lit crown, dark outer edge. */}
        <radialGradient id={`${id}t`} gradientUnits="userSpaceOnUse" cx="60" cy="60" r={outer}>
          <stop offset={at(0)} stopColor="#000" stopOpacity=".42" />
          <stop offset={at(0.28)} stopColor="#000" stopOpacity="0" />
          <stop offset={at(0.55)} stopColor="#fff" stopOpacity=".28" />
          <stop offset={at(0.8)} stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".38" />
        </radialGradient>
        {/* Key light from the top left. */}
        <linearGradient id={`${id}l`} gradientUnits="userSpaceOnUse" x1={60 - outer} y1={60 - outer} x2={60 + outer} y2={60 + outer}>
          <stop offset="0" stopColor="#fff" stopOpacity=".35" />
          <stop offset=".5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".32" />
        </linearGradient>
      </defs>
      <circle {...band} cx={68} cy={70} stroke={SHADOW} filter={`url(#${id}s)`} />
      <g filter={`url(#${id}b)`}>
        <circle {...band} style={{ stroke: b }} />
        {striped && <circle {...band} stroke={a} strokeDasharray={`${C / 8} ${C / 8}`} />}
        {striped &&
          Array.from({ length: 8 }, (_, k) => {
            const [x1, y1] = xy(inner, k * 45)
            const [x2, y2] = xy(outer, k * 45)
            return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#000" strokeOpacity=".1" strokeWidth=".8" />
          })}
        <circle {...band} stroke={`url(#${id}t)`} />
        <circle {...band} stroke={`url(#${id}l)`} />
        <path d={`M${polar(R + tube * 0.3, 196)}A${R + tube * 0.3} ${R + tube * 0.3} 0 0 1 ${polar(R + tube * 0.3, 252)}`} fill="none" stroke="#fff" strokeOpacity=".8" strokeWidth={tube * 0.32} strokeLinecap="round" />
        <path d={`M${polar(R - tube * 0.35, 20)}A${R - tube * 0.35} ${R - tube * 0.35} 0 0 1 ${polar(R - tube * 0.35, 60)}`} fill="none" stroke="#fff" strokeOpacity=".3" strokeWidth={tube * 0.18} strokeLinecap="round" />
      </g>
    </svg>
  )
}

/**
 * A beach ball with its pole tilted toward the viewer, so the panels curve like a real sphere instead of meeting in
 * the middle like a pie. Panel outlines are meridians projected onto the screen, cut off at the silhouette.
 */
function ballPanels(tilt: number, phase: number, R = 42) {
  const st = Math.sin(tilt)
  const ct = Math.cos(tilt)
  const P = (th: number, ph: number) => {
    const x = Math.sin(th) * Math.cos(ph)
    const y = Math.cos(th)
    const z = Math.sin(th) * Math.sin(ph)
    return `${(60 + R * x).toFixed(2)} ${(60 - R * (y * ct - z * st)).toFixed(2)}`
  }
  // Where a meridian disappears behind the ball.
  const edge = (ph: number) => Math.atan2(-st, Math.sin(ph) * ct) + Math.PI
  const n = 6
  const panels = Array.from({ length: n }, (_, i) => {
    const a = phase + (i / n) * Math.PI * 2
    const b = phase + ((i + 1) / n) * Math.PI * 2
    const pts: string[] = []
    for (let k = 0; k <= 18; k++) pts.push(P((edge(a) * k) / 18, a))
    for (let k = 1; k < 14; k++) {
      const ph = a + ((b - a) * k) / 14
      pts.push(P(edge(ph), ph))
    }
    for (let k = 18; k >= 0; k--) pts.push(P((edge(b) * k) / 18, b))
    return `M${pts.join('L')}Z`
  })
  const cap = `M${Array.from({ length: 24 }, (_, k) => P(0.3, (k / 24) * Math.PI * 2)).join('L')}Z`
  return { panels, cap }
}

function BeachBall({ blur, colors }: { blur: number; colors: string[] }) {
  const id = useId().replace(/:/g, '')
  const [{ panels, cap }] = useState(() => ballPanels(between(0.55, 0.85), between(0, Math.PI * 2)))
  return (
    <svg viewBox={VIEWBOX} className="block h-auto w-full">
      <defs>
        <Filters id={id} blur={blur} />
        <radialGradient id={`${id}g`} gradientUnits="userSpaceOnUse" cx="44" cy="40" r="64">
          <stop offset="0" stopColor="#fff" stopOpacity=".45" />
          <stop offset=".22" stopColor="#fff" stopOpacity=".08" />
          <stop offset=".5" stopColor="#000" stopOpacity="0" />
          <stop offset=".85" stopColor="#000" stopOpacity=".3" />
          <stop offset="1" stopColor="#000" stopOpacity=".45" />
        </radialGradient>
      </defs>
      <circle cx="68" cy="70" r="40" fill={SHADOW} filter={`url(#${id}s)`} />
      <g filter={`url(#${id}b)`}>
        <circle cx="60" cy="60" r="42" style={{ fill: WHITE }} />
        {panels.map((d, i) => (i % 2 === 0 ? <path key={i} d={d} fill={colors[(i / 2) % colors.length]} /> : null))}
        <path d={cap} style={{ fill: WHITE }} />
        <circle cx="60" cy="60" r="42" fill={`url(#${id}g)`} />
        <ellipse cx="45" cy="38" rx="9" ry="5" fill="#fff" opacity=".75" transform="rotate(-35 45 38)" />
      </g>
    </svg>
  )
}

/** A rubber duck, side on, lit from the top left. */
function Duck({ blur }: { blur: number }) {
  const id = useId().replace(/:/g, '')
  const body = 'M20 80C19 66 32 59 48 61C60 62 70 61 80 54C87 49 97 45 101 51C105 58 102 69 97 77C90 91 73 98 55 98C35 98 21 91 20 80Z'
  return (
    <svg viewBox={VIEWBOX} className="block h-auto w-full">
      <defs>
        <Filters id={id} blur={blur} />
        <linearGradient id={`${id}v`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".35" />
          <stop offset=".45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#b45309" stopOpacity=".45" />
        </linearGradient>
        <radialGradient id={`${id}h`} cx=".36" cy=".3" r=".75">
          <stop offset="0" stopColor="#fff" stopOpacity=".55" />
          <stop offset=".4" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#b45309" stopOpacity=".4" />
        </radialGradient>
      </defs>
      <ellipse cx="66" cy="104" rx="42" ry="9" fill={SHADOW} filter={`url(#${id}s)`} />
      <g filter={`url(#${id}b)`}>
        <path d={body} fill="#ffd23f" />
        <path d={body} fill={`url(#${id}v)`} />
        <path d="M56 74C64 66 80 65 86 72C82 83 69 86 58 81C55 79 54 76 56 74Z" fill="#f4b41a" />
        <path d="M60 73C67 69 76 68 81 71" fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="2" strokeLinecap="round" />
        <circle cx="45" cy="42" r="20" fill="#ffd23f" />
        <circle cx="45" cy="42" r="20" fill={`url(#${id}h)`} />
        <path d="M27 44C19 42 11 45 12 50C13 55 22 56 30 52Z" fill="#ff8a1f" />
        <path d="M14 50C19 52 24 52 29 50" fill="none" stroke="#c2410c" strokeOpacity=".6" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="39" cy="37" r="3.4" fill="#1d2330" />
        <circle cx="40.2" cy="35.8" r="1.2" fill="#fff" />
        <ellipse cx="38" cy="29" rx="7" ry="3.5" fill="#fff" opacity=".55" transform="rotate(-25 38 29)" />
      </g>
    </svg>
  )
}
