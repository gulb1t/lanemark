import { useEffect, useRef } from 'react'
import { useTheme } from '../../lib/theme'

/**
 * Pool-floor caustics rendered with a small WebGL fragment shader.
 *
 * Two layers of animated Voronoi cells are domain-warped so their edges drift like light through moving water;
 * the thin bright lines where cells meet read as caustics. Moving the pointer drops ripples that bend the light.
 * The canvas renders at a fraction of the display resolution (the pattern is soft, so upscaling is invisible),
 * stops when scrolled offscreen or in a background tab, and draws a single still frame for reduced motion.
 * With `drops`, a drop lands every few seconds (the first one right behind the hero headline).
 */

const VERT = `
attribute vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }
`

const FRAG = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uRipples[6];   // xy in pixels, z = start time
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uLight;
uniform float uGain;
uniform float uSoft;   // 0 = crisp filaments, 1 = out-of-focus light

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

// Distance to the nearest Voronoi edge (0 on an edge).
float edge(vec2 x, float t) {
  vec2 n = floor(x);
  vec2 f = fract(x);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = 0.5 + 0.45 * sin(t + 6.2831 * hash2(n + g));
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
    }
  }
  return sqrt(d2) - sqrt(d1);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  float scale = 3.4 / uRes.y;
  vec2 p = frag * scale;

  // Ripples (pointer and falling drops): a packet of wavelets that bends the light outwards and focuses it along
  // the crests. They spread, stretch and fade as they travel, so no hard ring is ever drawn.
  float lift = 0.0;
  for (int k = 0; k < 6; k++) {
    vec3 rp = uRipples[k];
    float age = uTime - rp.z;
    if (rp.z < 0.0 || age > 3.2) continue;
    vec2 dv = frag - rp.xy;
    float d = length(dv) * scale;
    float front = age * 1.1;
    float width = 5.0 / (1.0 + age * 1.6);
    float fade = (1.0 - age / 3.2) * (1.0 - age / 3.2) / (1.0 + d * 1.5);
    float ring = sin((d - front) * 18.0) * exp(-abs(d - front) * width) * fade * smoothstep(0.0, 0.25, age);
    p += normalize(dv + 0.0001) * ring * 0.07;
    lift += ring;
  }

  // Slow currents: two layers of warping bend the cell edges into curved filaments.
  float t = uTime;
  p += 0.32 * vec2(sin(p.y * 1.3 + t * 0.5 + sin(p.x * 0.7 + t * 0.2)), cos(p.x * 1.1 - t * 0.43 + cos(p.y * 0.9)));
  p += 0.12 * vec2(sin(p.y * 3.1 - t * 0.9), cos(p.x * 2.7 + t * 0.8));

  float e1 = edge(p, t * 0.55);
  float e2 = edge(p * 1.7 + vec2(3.1, 1.7), t * 0.8 + 2.0);
  float l1 = pow(1.0 - smoothstep(0.0, mix(0.12, 0.42, uSoft), e1), mix(2.6, 1.6, uSoft));
  float l2 = pow(1.0 - smoothstep(0.0, mix(0.09, 0.34, uSoft), e2), mix(2.4, 1.6, uSoft));
  // Where two filaments cross the light concentrates, like real caustics.
  float c = l1 * 0.7 + l2 * 0.45 + l1 * l2 * 1.2;
  // Light pools unevenly across the floor.
  c *= 0.6 + 0.4 * sin(p.x * 0.55 + t * 0.3) * sin(p.y * 0.45 - t * 0.22) + 0.25;
  // Crests focus light, troughs spread it.
  c = max(c * (1.0 + lift * 1.4) + max(lift, 0.0) * 0.08, 0.0);

  vec2 uv = frag / uRes;
  vec3 water = mix(uDeep, uShallow, smoothstep(0.0, 1.0, uv.y) * 0.9);
  // Light is strongest near the surface (top) and fades with depth.
  float depth = mix(0.35, 1.0, uv.y);
  vec3 col = water + uLight * c * uGain * depth;
  // Soft vignette.
  col *= 1.0 - 0.35 * pow(length(uv - vec2(0.5, 0.65)), 2.0);
  gl_FragColor = vec4(col, 1.0);
}
`

const PALETTE = {
  dark: { deep: [0.012, 0.03, 0.045], shallow: [0.02, 0.1, 0.13], light: [0.3, 0.95, 0.9], gain: 0.62 },
  // A sunny outdoor pool: clear aqua water with white light dancing on the floor.
  light: { deep: [0.38, 0.78, 0.88], shallow: [0.74, 0.93, 0.97], light: [1.0, 1.0, 1.0], gain: 0.72 },
} as const

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader error')
  return s
}

export function Caustics({
  className = '',
  resolution = 0.5,
  interactive = true,
  soft = 0,
  drops = false,
  palette = 'auto',
}: {
  className?: string
  resolution?: number
  interactive?: boolean
  soft?: number
  drops?: boolean
  /** 'dark' keeps night-pool colours in light mode too (panels that always carry white text). */
  palette?: 'auto' | 'dark'
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const theme = useTheme((s) => s.resolved)
  const themeRef = useRef(palette === 'dark' ? 'dark' : theme)
  useEffect(() => {
    themeRef.current = palette === 'dark' ? 'dark' : theme
  }, [theme, palette])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: false })
    if (!gl || gl.isContextLost()) {
      canvas.dataset.fallback = 'true'
      return
    }
    delete canvas.dataset.fallback

    let program: WebGLProgram
    try {
      program = gl.createProgram()!
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT))
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG))
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('link failed')
    } catch {
      canvas.dataset.fallback = 'true'
      return
    }
    gl.useProgram(program)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(program, 'a')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    const u = {
      res: gl.getUniformLocation(program, 'uRes'),
      time: gl.getUniformLocation(program, 'uTime'),
      ripples: gl.getUniformLocation(program, 'uRipples'),
      deep: gl.getUniformLocation(program, 'uDeep'),
      shallow: gl.getUniformLocation(program, 'uShallow'),
      light: gl.getUniformLocation(program, 'uLight'),
      gain: gl.getUniformLocation(program, 'uGain'),
      soft: gl.getUniformLocation(program, 'uSoft'),
    }

    const ripples = new Float32Array(18).fill(-1)
    let rippleIdx = 0
    const start = performance.now()
    const time = () => (performance.now() - start) / 1000
    const addRipple = (x: number, y: number, at: number) => {
      const i = rippleIdx++ % 6
      ripples[i * 3] = x
      ripples[i * 3 + 1] = y
      ripples[i * 3 + 2] = at
    }
    // First drop lands just behind the headline, later ones wander, 3.5 to 7 s apart.
    let nextDrop = 0.7
    let firstDrop = true
    function maybeDrop(now: number) {
      if (!drops || now < nextDrop) return
      const x = firstDrop ? 0.5 : 0.2 + Math.random() * 0.6
      const y = firstDrop ? 0.55 : 0.3 + Math.random() * 0.45
      addRipple(canvas!.width * x, canvas!.height * y, now)
      firstDrop = false
      nextDrop = now + 3.5 + Math.random() * 3.5
    }

    function resize() {
      const w = Math.max(1, Math.round(canvas!.clientWidth * resolution))
      const h = Math.max(1, Math.round(canvas!.clientHeight * resolution))
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w
        canvas!.height = h
        gl!.viewport(0, 0, w, h)
      }
    }

    function draw() {
      resize()
      const pal = PALETTE[themeRef.current]
      const now = time()
      maybeDrop(now)
      gl!.uniform2f(u.res, canvas!.width, canvas!.height)
      gl!.uniform1f(u.time, now)
      gl!.uniform3fv(u.ripples, ripples)
      gl!.uniform3fv(u.deep, pal.deep)
      gl!.uniform3fv(u.shallow, pal.shallow)
      gl!.uniform3fv(u.light, pal.light)
      gl!.uniform1f(u.gain, pal.gain * (1 - soft * 0.35))
      gl!.uniform1f(u.soft, soft)
      gl!.drawArrays(gl!.TRIANGLES, 0, 3)
    }

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Slow water looks the same at 30 fps, and on phones that halves the GPU and battery cost.
    const halfRate = window.matchMedia('(pointer: coarse)').matches
    let frame = 0
    let tick = 0
    let visible = true
    const loop = () => {
      if (!halfRate || tick++ % 2 === 0) draw()
      frame = requestAnimationFrame(loop)
    }
    const run = () => {
      if (!frame && visible && !document.hidden && !reduce) frame = requestAnimationFrame(loop)
    }
    const pause = () => {
      cancelAnimationFrame(frame)
      frame = 0
    }

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible) run()
      else pause()
    })
    io.observe(canvas)
    const onVisibility = () => (document.hidden ? pause() : run())
    document.addEventListener('visibilitychange', onVisibility)
    const ro = new ResizeObserver(() => reduce && draw())
    ro.observe(canvas)

    let lastRipple = 0
    const onPointer = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      if (e.clientY < r.top || e.clientY > r.bottom) return
      const now = time()
      if (e.type === 'pointermove' && now - lastRipple < 0.22) return
      lastRipple = now
      addRipple((e.clientX - r.left) * resolution, (r.bottom - e.clientY) * resolution, now)
    }
    if (interactive && !reduce) {
      window.addEventListener('pointermove', onPointer, { passive: true })
      window.addEventListener('pointerdown', onPointer, { passive: true })
    }

    if (reduce) draw()
    else run()

    return () => {
      pause()
      io.disconnect()
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('pointerdown', onPointer)
      // Free GPU objects but keep the context: React may re-run this effect on the same canvas.
      gl.deleteBuffer(buf)
      gl.deleteProgram(program)
    }
  }, [resolution, interactive, soft, drops])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`block h-full w-full bg-[linear-gradient(180deg,#041318,#02080b)] data-[fallback=true]:bg-[radial-gradient(ellipse_at_top,rgb(var(--accent-rgb)/0.25),transparent_70%)] ${className}`}
    />
  )
}
