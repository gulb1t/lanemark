/** The SwimTrack mark: a length of water that finishes as a check mark (public/logo.svg). */
export function Logo({ size = 32, className = '' }: { size?: number; className?: string; animated?: boolean }) {
  return <img src="/logo.svg" width={size} height={size} alt="" aria-hidden draggable={false} className={`shrink-0 select-none ${className}`} />
}

export function Wordmark({ size = 15 }: { size?: number }) {
  return (
    <span className="font-display font-bold tracking-tight" style={{ fontSize: size + 1 }}>
      SwimTrack
    </span>
  )
}
