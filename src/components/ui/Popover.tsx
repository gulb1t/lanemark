import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

/** Minimal anchored menu: click to toggle, closes on outside click, Esc or selection. */
export function Popover({
  trigger,
  children,
  align = 'end',
  side = 'bottom',
  label,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode
  children: (close: () => void) => ReactNode
  align?: 'start' | 'end'
  side?: 'top' | 'bottom'
  label: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label={label}
            initial={{ opacity: 0, y: side === 'bottom' ? -6 : 6, scale: 0.96, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: side === 'bottom' ? -4 : 4, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: `${side === 'bottom' ? 'top' : 'bottom'} ${align === 'end' ? 'right' : 'left'}` }}
            className={`absolute z-50 min-w-56 rounded-2xl border border-line-2 bg-panel/95 p-1.5 shadow-[var(--shadow-lg)] backdrop-blur-xl ${align === 'end' ? 'right-0' : 'left-0'} ${side === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'}`}
          >
            {children(() => setOpen(false))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function MenuItem({ icon, children, onSelect, tone = 'default', hint }: { icon?: ReactNode; children: ReactNode; onSelect: () => void; tone?: 'default' | 'danger'; hint?: ReactNode }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13.5px] transition-colors ${tone === 'danger' ? 'text-bad hover:bg-bad/10' : 'text-fg hover:bg-fg/[0.06]'}`}
    >
      {icon && <span className={tone === 'danger' ? '' : 'text-muted'}>{icon}</span>}
      <span className="flex-1">{children}</span>
      {hint}
    </button>
  )
}
