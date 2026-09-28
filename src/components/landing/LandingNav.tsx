import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring } from 'motion/react'
import { ArrowRight, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Logo, Wordmark } from '../Logo'
import { ThemeToggle } from '../ThemeToggle'
import { ButtonLink } from '../ui/Button'

const LINKS = [
  ['Tour', 'tour'],
  ['How it works', 'how'],
  ['Security', 'security'],
  ['Pricing', 'pricing'],
  ['FAQ', 'faq'],
] as const

/**
 * Transparent over the hero; once you scroll it settles into a compact glass pill with a thin progress line
 * along its bottom edge. Links get a sliding hover highlight and the section on screen is marked.
 */
export function LandingNav({ signedIn }: { signedIn: boolean }) {
  const { scrollY, scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 160, damping: 30, mass: 0.3 })
  const [scrolled, setScrolled] = useState(false)
  const [hover, setHover] = useState<string | null>(null)
  const [active, setActive] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 24))

  // Mark the section in the middle of the screen.
  useEffect(() => {
    const els = LINKS.map(([, id]) => document.getElementById(id)).filter((e): e is HTMLElement => Boolean(e))
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id)
      },
      { rootMargin: '-45% 0px -50% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, { once: true, passive: true })
    return () => window.removeEventListener('scroll', close)
  }, [open])

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex justify-center px-3 pt-3">
      <motion.nav
        aria-label="Main"
        initial={false}
        animate={{ maxWidth: scrolled ? 820 : 1180 }}
        transition={{ type: 'spring', stiffness: 260, damping: 34 }}
        className={`relative w-full rounded-full transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ${scrolled ? 'pill-nav' : 'border border-transparent'}`}
      >
        <div className="flex h-14 items-center gap-2 pl-4 pr-2">
          <Link to="/" className="mr-2 flex shrink-0 items-center gap-2.5" aria-label="Lanemark home">
            <Logo size={28} />
            <Wordmark />
          </Link>

          <ul className="mx-auto hidden items-center md:flex" onMouseLeave={() => setHover(null)}>
            {LINKS.map(([label, id]) => {
              const on = active === id
              return (
                <li key={id} className="relative">
                  <a
                    href={`#${id}`}
                    onMouseEnter={() => setHover(id)}
                    onFocus={() => setHover(id)}
                    aria-current={on ? 'location' : undefined}
                    className={`relative z-10 block rounded-full px-3.5 py-2 text-[13.5px] font-medium transition-colors ${on || hover === id ? 'text-fg' : 'text-muted'}`}
                  >
                    {label}
                  </a>
                  {hover === id && <motion.span layoutId="nav-hover" className="absolute inset-0 rounded-full bg-fg/[0.07]" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                  {on && <motion.span layoutId="nav-active" className="absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-aqua" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
                </li>
              )
            })}
          </ul>

          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <ThemeToggle />
            {!signedIn && (
              <Link to="/login" className="hidden rounded-full px-3.5 py-2 text-[13.5px] font-medium text-muted transition-colors hover:text-fg sm:block">
                Sign in
              </Link>
            )}
            <ButtonLink to={signedIn ? '/app' : '/signup'} variant="primary" size="sm" className="!h-9 !px-4">
              {signedIn ? 'Open app' : 'Get started'} <ArrowRight size={14} />
            </ButtonLink>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-label={open ? 'Close menu' : 'Open menu'}
              className="inline-flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-fg/[0.07] hover:text-fg md:hidden"
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Scroll progress: a hairline that fills along the bottom edge of the pill. */}
        <div aria-hidden className={`pointer-events-none absolute inset-x-6 -bottom-px h-px overflow-hidden transition-opacity duration-300 ${scrolled ? 'opacity-100' : 'opacity-0'}`}>
          <motion.div style={{ scaleX: progress }} className="h-full origin-left bg-gradient-to-r from-aqua via-blue to-aqua" />
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="pill-nav absolute inset-x-0 top-[calc(100%+8px)] origin-top rounded-3xl p-2 md:hidden"
            >
              {LINKS.map(([label, id]) => (
                <a key={id} href={`#${id}`} onClick={() => setOpen(false)} className="flex min-h-12 items-center rounded-2xl px-4 text-[15px] font-medium hover:bg-fg/[0.06]">
                  {label}
                </a>
              ))}
              <Link to="/privacy" className="flex min-h-12 items-center rounded-2xl px-4 text-[15px] font-medium hover:bg-fg/[0.06]">
                Privacy
              </Link>
              {!signedIn && (
                <Link to="/login" className="mt-1 flex min-h-12 items-center rounded-2xl border-t border-line px-4 text-[15px] font-semibold">
                  Sign in
                </Link>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>
    </header>
  )
}
