import { initials } from '../../lib/stats'

/** Stable hue derived from a name so a swimmer keeps the same colour everywhere. */
function hueOf(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
  return h
}

/** Initials on a colour made from the name. Swimmers are children, so SwimTrack keeps no photos of them. */
interface Props {
  name: string
  size?: number
  className?: string
}

export function Avatar({ name, size = 40, className = '' }: Props) {
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.36) }
  const h = hueOf(name)
  return (
    <span
      aria-hidden
      style={{
        ...style,
        background: `linear-gradient(135deg, hsl(${h} 70% 42%), hsl(${(h + 50) % 360} 70% 30%))`,
      }}
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full border border-fg/10 font-semibold text-white/95 ${className}`}
    >
      {/* Small ones sit overlapped in rows, where two letters would run under the next circle. */}
      {size <= 30 ? initials(name).slice(0, 1) : initials(name)}
    </span>
  )
}
