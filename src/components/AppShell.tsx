import { AnimatePresence, motion } from 'motion/react'
import { BookOpen, Building2, LayoutGrid, LifeBuoy, LogOut, MailWarning, Moon, Plus, Search, Settings, Sparkles, Sun, UserPlus, Users, X } from 'lucide-react'
import { api, errorMessage } from '../lib/api'
import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate, useOutlet } from 'react-router-dom'
import { buildDemoPool } from '../lib/demoPool'
import { isMac } from '../lib/hooks'
import { toggleTheme, useTheme } from '../lib/theme'
import { signOut } from '../lib/signout'
import { logout, useSession } from '../store/useSession'
import { openDialog, setPaletteOpen, toast, useUi } from '../store/useUi'
import { openAssistant, useAssistant } from '../store/useAssistant'
import { loadPool, setPool, usePool } from '../store/usePool'
import { Assistant } from './Assistant'
import { CommandPalette } from './CommandPalette'
import { NewClassDialog } from './dialogs/NewClassDialog'
import { SwimmerDialog } from './dialogs/SwimmerDialog'
import { Logo, Wordmark } from './Logo'
import { SyncIndicator } from './SyncIndicator'
import { ThemeToggle } from './ThemeToggle'
import { Avatar } from './ui/Avatar'
import { ButtonLink } from './ui/Button'
import { Kbd } from './ui/bits'
import { Modal } from './ui/Modal'
import { MenuItem, Popover } from './ui/Popover'

const NAV = [
  { to: '/app', label: 'Classes', icon: LayoutGrid, end: true },
  { to: '/app/swimmers', label: 'Swimmers', icon: Users },
  { to: '/app/curriculum', label: 'Curriculum', icon: BookOpen },
]
const POOL = { to: '/app/pool', label: 'Pool', icon: Building2, end: false }

/** The Pool tab appears once the account is in a pool (and always in the demo, which has a sample pool). */
function useNav() {
  const inPool = usePool((s) => Boolean(s.pool))
  return inPool ? [NAV[0], NAV[1], POOL, NAV[2]] : NAV
}

/** Loads the account's pool, or gives the demo its made-up one. */
function usePoolSetup() {
  const status = useSession((s) => s.status)
  const userId = useSession((s) => s.user?.id)
  const userName = useSession((s) => s.user?.name)
  useEffect(() => {
    if (!userId) return
    if (status === 'demo') setPool(buildDemoPool({ id: userId, name: userName ?? 'Demo Coach' }))
    else if (status === 'signedIn') void loadPool(userId).catch(() => usePool.setState({ status: 'ready' }))
  }, [status, userId, userName])
}

export default function AppShell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const outlet = useOutlet()
  const status = useSession((s) => s.status)
  const dialog = useUi((s) => s.dialog)
  const theme = useTheme((s) => s.resolved)
  const [demoBanner, setDemoBanner] = useState(true)
  const [shortcuts, setShortcuts] = useState(false)
  const nav = useNav()
  usePoolSetup()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const typing = target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault()
        setPaletteOpen(!useUi.getState().paletteOpen)
      } else if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && !useUi.getState().dialog && !document.querySelector('dialog[open], [role=dialog]')) {
        if (e.key === '?') setShortcuts(true)
        else if (e.key === 'n') openDialog('newClass')
        else return
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const closeDialog = () => useUi.setState({ dialog: null })

  return (
    <div className="relative flex min-h-dvh flex-col">
      <a href="#main" className="sr-only z-50 rounded-full bg-fg px-4 py-2 text-sm font-semibold text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>
      <div className="ambient" aria-hidden />

      {status === 'demo' && demoBanner && (
        <div className="no-print relative z-40 border-b border-aqua/20 bg-aqua/[0.07] text-[13px]">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 sm:px-6">
            <Sparkles size={14} className="shrink-0 text-aqua" />
            <span className="flex-1 text-muted">
              <span className="font-medium text-fg">You’re in the demo.</span>
              <span className="hidden sm:inline"> Everything stays in this browser. Create a free account to sync across devices.</span>
            </span>
            <Link to="/signup" className="shrink-0 font-semibold text-aqua hover:underline">
              Create account
            </Link>
            <button aria-label="Hide" onClick={() => setDemoBanner(false)} className="text-dim hover:text-fg">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {status === 'signedIn' && <VerifyEmailBanner />}

      <DesktopNav />

      {/* Phones and small tablets: compact top bar, see-through until the page scrolls under it */}
      <MobileBar />

      <main id="main" tabIndex={-1} className="relative z-10 mx-auto w-full max-w-6xl flex-1 outline-none px-4 pb-28 pt-6 sm:px-6 sm:pt-10 md:pb-12">
        <motion.div key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
          {outlet}
        </motion.div>
      </main>

      {/* Mobile: bottom tab bar */}
      <nav
        className="no-print fixed inset-x-3 bottom-3 z-30 flex h-16 items-stretch justify-around rounded-2xl pill-nav md:hidden"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Main"
      >
        {[...nav, { to: '/app/settings', label: 'Settings', icon: Settings, end: false }].map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="relative flex flex-1 flex-col items-center justify-center gap-1 text-[10.5px] font-medium">
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span layoutId="tab-pill" className="absolute inset-1.5 rounded-xl bg-aqua/10" transition={{ type: 'spring', stiffness: 480, damping: 38 }} />
                )}
                <Icon size={19} className={`relative transition-colors ${isActive ? 'text-aqua' : 'text-muted'}`} />
                <span className={`relative ${isActive ? 'text-fg' : 'text-dim'}`}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
        <button type="button" onClick={() => setPaletteOpen(true)} className="flex flex-1 flex-col items-center justify-center gap-1 text-[10.5px] font-medium text-dim">
          <Search size={19} className="text-muted" />
          Search
        </button>
      </nav>

      <CommandPalette />
      <Assistant />
      {shortcuts && <ShortcutsDialog onClose={() => setShortcuts(false)} />}
      <AnimatePresence>{dialog === 'newClass' && <NewClassDialog onClose={closeDialog} />}</AnimatePresence>
      {dialog === 'newSwimmer' && (
        <SwimmerDialog
          onClose={closeDialog}
          onCreated={(id) => {
            closeDialog()
            navigate(`/app/swimmers/${id}`)
          }}
        />
      )}
      <span className="sr-only" aria-live="polite">
        {theme} theme
      </span>
    </div>
  )
}

/** True once the page has scrolled a little, for bars that turn to glass when content slides under them. */
function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = useState(() => typeof window !== 'undefined' && window.scrollY > threshold)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > threshold)
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [threshold])
  return scrolled
}

/**
 * Desktop: a floating pill, like the landing page's. Clear at the top of the page, frosted glass once content scrolls
 * under it. Links get a sliding hover highlight; the current page gets a filled pill and an aqua icon.
 */
function DesktopNav() {
  const scrolled = useScrolled()
  const nav = useNav()
  const [hover, setHover] = useState<string | null>(null)
  return (
    <header className="no-print sticky top-3 z-30 mx-auto hidden w-[calc(100%-2rem)] max-w-6xl md:block">
      <div
        className={`flex h-14 items-center gap-1 rounded-full pl-4 pr-2 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ${scrolled ? 'pill-nav' : 'border border-transparent'}`}
      >
        <Link to="/app" className="flex shrink-0 items-center gap-2.5" aria-label="SwimTrack home">
          <Logo size={28} />
          <span className="max-lg:hidden">
            <Wordmark />
          </span>
        </Link>
        <span aria-hidden className="mx-3 h-5 w-px bg-line-2" />
        <nav className="flex items-center" aria-label="Main" onMouseLeave={() => setHover(null)}>
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onMouseEnter={() => setHover(to)} onFocus={() => setHover(to)} className="relative rounded-full px-3.5 py-2 text-[13.5px] font-medium">
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="app-nav-active"
                      className="absolute inset-0 rounded-full bg-fg/[0.08] shadow-[inset_0_0_0_1px_var(--color-line)]"
                      transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                    />
                  )}
                  {hover === to && !isActive && (
                    <motion.span layoutId="app-nav-hover" className="absolute inset-0 rounded-full bg-fg/[0.05]" transition={{ type: 'spring', stiffness: 520, damping: 40 }} />
                  )}
                  <span className={`relative flex items-center gap-2 transition-colors ${isActive ? 'text-fg' : 'text-muted hover:text-fg'}`}>
                    <Icon size={15} className={`transition-colors ${isActive ? 'text-aqua' : ''}`} />
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="flex-1" />
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Search or jump to"
            className="flex h-9 items-center gap-2 rounded-full border border-line bg-fg/[0.03] pl-3 pr-1.5 text-[13px] text-dim transition-colors hover:border-line-2 hover:text-muted max-lg:w-9 max-lg:justify-center max-lg:px-0"
          >
            <Search size={14} />
            <span className="mr-1 max-lg:hidden">Search</span>
            <span className="flex gap-0.5 max-lg:hidden">
              <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
          <NewMenu />
          <span aria-hidden className="mx-1 h-5 w-px bg-line-2" />
          <SyncIndicator />
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  )
}

/** "+ New": the two things people create, one click from any page. */
function NewMenu() {
  return (
    <Popover
      label="Create"
      trigger={({ toggle, open }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label="New"
          className="btn-primary ml-1 inline-flex h-9 items-center justify-center gap-1.5 rounded-full pl-3 pr-3.5 text-[13px] font-semibold max-md:w-9 max-md:px-0"
        >
          <Plus size={15} strokeWidth={2.5} className={`transition-transform duration-200 ${open ? 'rotate-45' : ''}`} />
          <span className="max-md:hidden">New</span>
        </button>
      )}
    >
      {(close) => (
        <>
          <MenuItem icon={<LayoutGrid size={15} />} hint={<Kbd>N</Kbd>} onSelect={() => (close(), openDialog('newClass'))}>
            New class
          </MenuItem>
          <MenuItem icon={<UserPlus size={15} />} onSelect={() => (close(), openDialog('newSwimmer'))}>
            New swimmer
          </MenuItem>
        </>
      )}
    </Popover>
  )
}

function MobileBar() {
  const scrolled = useScrolled()
  const assistant = useAssistant((s) => s.enabled)
  return (
    <header
      className={`no-print sticky top-0 z-30 border-b transition-[background-color,border-color,backdrop-filter] duration-300 md:hidden ${scrolled ? 'border-line bg-ink/75 backdrop-blur-xl' : 'border-transparent'}`}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex h-14 items-center gap-2 px-4">
        <Link to="/app" className="flex items-center gap-2" aria-label="SwimTrack home">
          <Logo size={28} />
          <Wordmark />
        </Link>
        <div className="flex-1" />
        {assistant && (
          <button type="button" onClick={openAssistant} aria-label="Ask the SwimTrack assistant" className="inline-flex size-9 items-center justify-center rounded-full text-aqua transition-colors hover:bg-fg/[0.07]">
            <Sparkles size={18} />
          </button>
        )}
        <SyncIndicator compact />
        <UserMenu />
      </div>
    </header>
  )
}

/** Reminder until the account's email is confirmed (needed for password resets and security alerts). */
function VerifyEmailBanner() {
  const user = useSession((s) => s.user)
  const [hidden, setHidden] = useState(() => sessionStorage.getItem('st_hide_verify') === '1')
  const [busy, setBusy] = useState(false)
  if (!user || user.emailVerified !== false || hidden) return null
  const hide = () => {
    sessionStorage.setItem('st_hide_verify', '1')
    setHidden(true)
  }
  async function resend() {
    setBusy(true)
    try {
      await api('/account/email/resend', 'POST')
      toast(`Sent a new link to ${user!.email}`)
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="no-print relative z-40 border-b border-warn/20 bg-warn/[0.07] text-[13px]" role="status">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 sm:px-6">
        <MailWarning size={14} className="shrink-0 text-warn" />
        <span className="min-w-0 flex-1 text-muted">
          <span className="font-medium text-fg">Confirm your email.</span> <span className="hidden sm:inline">We sent a link to {user.email} so you can reset your password if you ever need to.</span>
        </span>
        <button type="button" onClick={resend} disabled={busy} className="shrink-0 font-semibold text-fg underline-offset-4 hover:underline disabled:opacity-50">
          Resend link
        </button>
        <button aria-label="Hide for now" onClick={hide} className="text-dim hover:text-fg">
          <X size={14} />
        </button>
      </div>
    </div>
  )
}

const SHORTCUTS: [string, [string, string[]][]][] = [
  ['Anywhere', [['Search or jump to…', [isMac ? '⌘' : 'Ctrl', 'K']], ['Search', ['/']], ['New class', ['N']], ['Show shortcuts', ['?']]]],
  ['Taking attendance', [['Next / previous swimmer', ['↓', '↑']], ['Present · late · absent', ['P', 'L', 'A']], ['Clear a mark', ['⌫']]]],
  ['Report cards', [['Next / previous swimmer', ['→', '←']], ['Same, without leaving the home row', ['J', 'K']], ['Back to the class', ['Esc']]]],
]

function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title="Keyboard shortcuts" description="For the laptop at the front desk. Everything also works by tapping." size="sm">
      <div className="space-y-5">
        {SHORTCUTS.map(([group, rows]) => (
          <section key={group}>
            <h3 className="mb-2 text-[12.5px] font-semibold text-dim">{group}</h3>
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {rows.map(([label, keys]) => (
                <li key={label} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[14px]">
                  {label}
                  <span className="flex shrink-0 gap-1">
                    {keys.map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  )
}

function UserMenu() {
  const navigate = useNavigate()
  const user = useSession((s) => s.user)
  const status = useSession((s) => s.status)
  const theme = useTheme((s) => s.resolved)
  if (!user) return null
  return (
    <Popover
      label="Account"
      trigger={({ toggle, open }) => (
        <button type="button" onClick={toggle} aria-expanded={open} aria-label="Account menu" data-tour="account" className="ml-1 rounded-full ring-2 ring-transparent transition hover:ring-line-2">
          <Avatar name={user.name} size={32} />
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="px-2.5 pb-2 pt-1.5">
            <div className="truncate text-sm font-semibold">{user.name}</div>
            <div className="truncate text-xs text-muted">{status === 'demo' ? 'Demo mode · this browser only' : user.email}</div>
          </div>
          <div className="my-1 h-px bg-line" />
          <MenuItem icon={<LifeBuoy size={15} />} onSelect={() => (close(), navigate('/help'))}>
            Help and guides
          </MenuItem>
          <MenuItem icon={<Settings size={15} />} onSelect={() => (close(), navigate('/app/settings'))}>
            Settings
          </MenuItem>
          <MenuItem
            icon={theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            onSelect={() => {
              close()
              toggleTheme()
            }}
          >
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </MenuItem>
          <div className="my-1 h-px bg-line" />
          {status === 'demo' ? (
            <>
              <div className="px-1 pb-1">
                <ButtonLink to="/signup" variant="primary" size="sm" className="w-full" onClick={close}>
                  Create a free account
                </ButtonLink>
              </div>
              <MenuItem icon={<LogOut size={15} />} onSelect={() => (close(), void logout().then(() => navigate('/')))}>
                Leave demo
              </MenuItem>
            </>
          ) : (
            <MenuItem
              tone="danger"
              icon={<LogOut size={15} />}
              onSelect={() => {
                close()
                void signOut(navigate).then((done) => done && toast('Signed out'))
              }}
            >
              Sign out
            </MenuItem>
          )}
        </>
      )}
    </Popover>
  )
}
