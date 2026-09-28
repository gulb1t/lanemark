import { motion } from 'motion/react'
import { ArrowLeft, ArrowRight, CalendarCheck, CirclePlay, FileText, Lightbulb, Plus, RotateCcw, Search, ZoomIn } from 'lucide-react'
import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Logo, Wordmark } from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'
import { Button, ButtonLink } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { GUIDE, type GuideTopic } from '../data/guide'
import SHOTS from '../data/guideShots.json'
import { useTheme } from '../lib/theme'
import { useSession } from '../store/useSession'
import { restartTours } from '../store/useTour'

const shots = SHOTS as Record<string, { width: number; height: number }>

/** Turns **bold** in guide text into <b>. */
function rich(text: string): ReactNode {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 ? (
      <b key={i} className="font-semibold text-fg">
        {part}
      </b>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  )
}

const QUICK = [
  { id: 'new-class', n: 1, title: 'Make a class', body: 'Pick the level. The skills load in for you.', icon: Plus },
  { id: 'attendance', n: 2, title: 'Take attendance', body: 'A few taps at the start of every lesson.', icon: CalendarCheck },
  { id: 'write-reports', n: 3, title: 'Write report cards', body: 'Three steps per swimmer. Lanemark writes the comment.', icon: FileText },
]

/** How-to guides with screenshots, a "Try it" for each, and a way to replay the in-app tours. */
export default function Help() {
  const navigate = useNavigate()
  const status = useSession((s) => s.status)
  const inApp = status === 'signedIn' || status === 'demo'
  const [q, setQ] = useState('')
  const [zoom, setZoom] = useState<GuideTopic | null>(null)

  const sections = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return GUIDE
    return GUIDE.map((s) => ({
      ...s,
      topics: s.topics.filter((t) => [t.title, t.summary, ...t.steps, ...(t.tips ?? [])].join(' ').toLowerCase().includes(needle)),
    })).filter((s) => s.topics.length)
  }, [q])

  function replay() {
    restartTours()
    // The demo entry sends signed-in people to their own home screen, where the first tour starts.
    navigate('/demo?go=dashboard')
  }

  return (
    <div className="relative min-h-dvh">
      <div className="ambient" aria-hidden />
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-5">
        <Link to={inApp ? '/app' : '/'} className="flex items-center gap-2.5" aria-label="Lanemark home">
          <Logo size={30} />
          <Wordmark />
        </Link>
        <div className="flex items-center gap-2">
          <Link to={inApp ? '/app' : '/'} className="hidden items-center gap-1.5 text-sm text-muted hover:text-fg sm:flex">
            <ArrowLeft size={15} /> {inApp ? 'Back to the app' : 'Home'}
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-24 pt-6">
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="max-w-2xl">
          <p className="eyebrow mb-3">Help and guides</p>
          <h1 className="page-title !text-[clamp(2.2rem,6vw,3.4rem)]">
            How to use <span className="accent">Lanemark</span>
          </h1>
          <p className="mt-4 text-[16.5px] leading-relaxed text-muted">
            Short guides with pictures. Every one has a <b className="font-semibold text-fg">Try it</b> button that opens the real screen{inApp ? '' : ' in the demo'}.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="primary" icon={<RotateCcw size={15} />} onClick={replay}>
              Replay the tour
            </Button>
            {!inApp && (
              <ButtonLink to="/demo" icon={<CirclePlay size={15} />}>
                Try the demo
              </ButtonLink>
            )}
          </div>
        </motion.section>

        <div className="mt-10 grid gap-3 md:grid-cols-3">
          {QUICK.map(({ id, n, title, body, icon: Icon }) => (
            <a key={id} href={`#${id}`} className="card spotlight group flex items-start gap-4 p-5">
              <span className="icon-tile size-10 shrink-0 !rounded-xl">
                <Icon size={18} />
              </span>
              <span className="min-w-0">
                <span className="tabular-nums text-[11px] text-dim">Step {n}</span>
                <span className="mt-0.5 block text-[15.5px] font-semibold">{title}</span>
                <span className="mt-1 block text-[13.5px] text-muted">{body}</span>
              </span>
              <ArrowRight size={16} className="ml-auto mt-1 shrink-0 text-dim transition-transform group-hover:translate-x-0.5 group-hover:text-fg" />
            </a>
          ))}
        </div>

        <div className="relative mt-10 max-w-xl">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-dim" />
          <input
            className="input h-12 pl-10 text-[15px]"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the guide: print, attendance, offline…"
            aria-label="Search the guide"
          />
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[14rem_minmax(0,1fr)]">
          <nav aria-label="Guide contents" className="hidden lg:block">
            <ul className="sticky top-8 space-y-4 text-[13.5px]">
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="block px-3 font-semibold text-fg hover:text-aqua">
                    {s.title}
                  </a>
                  <ul className="mt-1 space-y-0.5">
                    {s.topics.map((t) => (
                      <li key={t.id}>
                        <a href={`#${t.id}`} className="block rounded-lg px-3 py-1 text-muted transition-colors hover:bg-fg/[0.05] hover:text-fg">
                          {t.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </nav>

          <div className="min-w-0 space-y-16">
            {!sections.length && (
              <p className="card px-6 py-10 text-center text-muted">
                Nothing matches “{q.trim()}”. Try another word, like{' '}
                <button className="font-semibold text-fg underline-offset-4 hover:underline" onClick={() => setQ('print')}>
                  print
                </button>
                .
              </p>
            )}
            {sections.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-8">
                <h2 className="font-display text-[1.7rem] font-bold tracking-tight">{s.title}</h2>
                <p className="mt-1 text-[15px] text-muted">{s.intro}</p>
                <div className="mt-6 space-y-6">
                  {s.topics.map((t) => (
                    <TopicCard key={t.id} topic={t} inApp={inApp} onZoom={() => setZoom(t)} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>

      <Modal open={Boolean(zoom)} onClose={() => setZoom(null)} title={zoom?.title ?? ''} size="xl">
        {zoom?.shot && <Shot name={zoom.shot} alt={zoom.title} />}
      </Modal>
    </div>
  )
}

function Shot({ name, alt }: { name: string; alt: string }) {
  const theme = useTheme((s) => s.resolved)
  const size = shots[name]
  if (!size) return null
  return (
    <img
      src={`/guide/${name}-${theme}.webp`}
      alt={alt}
      width={size.width}
      height={size.height}
      loading="lazy"
      decoding="async"
      className="h-auto w-full rounded-xl border border-line bg-panel-2 shadow-[var(--shadow-lg)]"
    />
  )
}

function TopicCard({ topic, inApp, onZoom }: { topic: GuideTopic; inApp: boolean; onZoom: () => void }) {
  const hasShot = Boolean(topic.shot && shots[topic.shot])
  return (
    <article id={topic.id} className="card scroll-mt-8 overflow-hidden">
      <div className={`grid gap-6 p-5 sm:p-7 ${hasShot ? 'xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]' : ''}`}>
        <div className="min-w-0">
          <h3 className="font-display text-[1.3rem] font-bold leading-tight tracking-tight">{topic.title}</h3>
          <p className="mt-1.5 text-[14.5px] text-muted">{topic.summary}</p>
          <ol className="mt-5 space-y-3">
            {topic.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-[14.5px] leading-relaxed text-muted">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-aqua/12 tabular-nums text-[12px] font-bold text-aqua">{i + 1}</span>
                <span>{rich(step)}</span>
              </li>
            ))}
          </ol>
          {topic.tips && (
            <div className="mt-5 space-y-2 rounded-2xl bg-fg/[0.035] p-4">
              {topic.tips.map((tip, i) => (
                <p key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed text-muted">
                  <Lightbulb size={15} className="mt-0.5 shrink-0 text-warn" />
                  <span>{rich(tip)}</span>
                </p>
              ))}
            </div>
          )}
          {topic.tryIt && (
            <ButtonLink to={`/demo?go=${topic.tryIt}`} variant="primary" size="sm" icon={<CirclePlay size={14} />} className="mt-5">
              {inApp ? 'Show me' : 'Try it in the demo'}
            </ButtonLink>
          )}
        </div>
        {hasShot && (
          <button type="button" onClick={onZoom} className="group relative block self-start text-left" aria-label={`Enlarge the picture: ${topic.title}`}>
            <Shot name={topic.shot!} alt={topic.title} />
            <span className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-full bg-ink/70 text-fg opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
              <ZoomIn size={15} />
            </span>
          </button>
        )}
      </div>
    </article>
  )
}
