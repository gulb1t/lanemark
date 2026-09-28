import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { uiZoom } from '../../lib/textSize'

/**
 * Minimal anchored menu: click to toggle, closes on outside click, Esc or selection. The menu is rendered on the
 * page body and pinned to its button, so a card with overflow hidden can't cut it off, and it opens upward when
 * there isn't room below.
 */
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
  const menu = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (!ref.current?.contains(target) && !menu.current?.contains(target)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      ref.current?.querySelector<HTMLElement>('button, a')?.focus()
    }
    // The menu lives at the end of the page, so tabbing out of it (or past the button) closes it.
    const onFocus = (e: FocusEvent) => {
      const target = e.target as Node
      if (!ref.current?.contains(target) && !menu.current?.contains(target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    document.addEventListener('focusin', onFocus)
    // Focus the first item so the keyboard goes straight into the menu, as it did when it sat next to the button.
    menu.current?.querySelector<HTMLElement>('[role=menuitem], a, button')?.focus({ preventScroll: true })
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('focusin', onFocus)
    }
  }, [open])

  // Placed before paint, and again whenever anything scrolls or the window resizes, so it stays with its button.
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const box = ref.current?.getBoundingClientRect()
      const el = menu.current
      if (!box || !el) return
      // Measured on screen, placed in the page's (zoomed) pixels: see Display size.
      const z = uiZoom()
      const anchor = { top: box.top / z, bottom: box.bottom / z, left: box.left / z, right: box.right / z }
      const vh = window.innerHeight / z
      const gap = 8
      const below = vh - anchor.bottom
      const fitsBelow = below >= el.offsetHeight + gap * 2
      const up = side === 'top' ? anchor.top >= el.offsetHeight + gap * 2 || anchor.top > below : !fitsBelow && anchor.top > below
      el.style.top = up ? '' : `${anchor.bottom + gap}px`
      el.style.bottom = up ? `${vh - anchor.top + gap}px` : ''
      // Kept inside the screen even when the button sits near an edge (phones).
      const vw = document.documentElement.clientWidth / z
      const room = Math.max(gap, vw - el.offsetWidth - gap)
      el.style.left = align === 'start' ? `${Math.min(Math.max(gap, anchor.left), room)}px` : ''
      el.style.right = align === 'end' ? `${Math.min(Math.max(gap, vw - anchor.right), room)}px` : ''
      el.style.maxWidth = `${vw - gap * 2}px`
      el.style.transformOrigin = `${up ? 'bottom' : 'top'} ${align === 'end' ? 'right' : 'left'}`
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, side, align])

  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={menu}
              role="menu"
              aria-label={label}
              initial={{ opacity: 0, scale: 0.96, filter: 'blur(4px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="fixed z-50 min-w-56 rounded-2xl border border-line-2 bg-panel/95 p-1.5 shadow-[var(--shadow-lg)] backdrop-blur-xl"
            >
              {children(() => setOpen(false))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
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
