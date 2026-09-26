import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import {
  AlertTriangle,
  ArrowRight,
  ArrowUp,
  Building2,
  CalendarCheck,
  Check,
  ChevronDown,
  Clock,
  CloudOff,
  Fingerprint,
  KeyRound,
  Layers,
  Lock,
  MessageCircleQuestion,
  MonitorSmartphone,
  Route,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Tag,
  Users,
  Waves,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Caustics } from '../components/fx/Caustics'
import { LevelCloud, LiveLessons, LiveSync, LiveTwoFactor } from '../components/landing/LiveDemos'
import { LandingNav } from '../components/landing/LandingNav'
import { Floaties } from '../components/landing/Floaties'
import { Pricing } from '../components/landing/Pricing'
import { Showcase } from '../components/landing/Showcase'
import { Logo, Wordmark } from '../components/Logo'
import { ButtonLink } from '../components/ui/Button'
import { NumberTicker } from '../components/ui/bits'
import { LEVEL_BY_ID, LEVELS } from '../data/curriculum'
import { useSession } from '../store/useSession'

const SKILL_COUNT = LEVELS.reduce((n, l) => n + l.skills.length, 0)

export default function Landing() {
  const status = useSession((s) => s.status)
  const signedIn = status === 'signedIn' || status === 'demo'

  return (
    <div className="relative overflow-x-clip">
      <LandingNav signedIn={signedIn} />
      <Hero signedIn={signedIn} />
      <Tour />
      <SkillMarquee />
      <Audience />
      <Features />
      <SessionStory />
      <Security />
      <Pricing
        signedIn={signedIn}
        heading={
          <SectionTitle icon={<Tag size={22} />} title={<>Free for instructors. <Serif>Simple</Serif> for pools.</>}>
            Instructors use every feature for free. Pools and cities add setup, support and their own server.
          </SectionTitle>
        }
      />
      <Faq />
      <FinalCta signedIn={signedIn} />
      <Footer signedIn={signedIn} />
    </div>
  )
}

function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="relative flex min-h-[100svh] flex-col items-center justify-center px-4 pb-24 pt-28 text-center">
      <div className="absolute inset-0 -z-10 overflow-hidden [mask-image:linear-gradient(180deg,#000_55%,transparent)]">
        <Caustics className="h-full w-full" soft={1} resolution={0.3} drops />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,var(--color-ink)_90%)]" />
        {/* Toys float above the edge vignette but under the fog behind the headline. */}
        <Floaties />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_45%,color-mix(in_oklab,var(--color-ink)_55%,transparent),transparent_80%)]" />
      </div>

      <motion.a
        href="#tour"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="glass group relative z-10 mb-7 inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-[12.5px] text-muted transition-colors hover:text-fg"
      >
        <span className="rounded-full bg-aqua/15 px-2 py-0.5 font-semibold text-aqua">New</span>
        Report cards that write themselves
        <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
      </motion.a>

      <h1 aria-label="Every length, logged." className="pointer-events-none relative z-10 max-w-4xl text-[clamp(2.6rem,8.5vw,6.5rem)] font-extrabold leading-[1.02] tracking-[-0.04em]">
        <motion.span
          aria-hidden
          initial={{ opacity: 0, filter: 'blur(12px)', y: 14 }}
          animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="inline-block whitespace-nowrap pb-1"
        >
          <span className="text-gradient">Every </span>
          <RotatingWord />
          <span className="text-gradient">,</span>
        </motion.span>
        <br />
        <motion.span
          initial={{ opacity: 0, filter: 'blur(12px)', y: 16 }}
          animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
          transition={{ duration: 0.9, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="accent"
        >
          logged.
        </motion.span>
      </h1>

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.45 }}
        className="pointer-events-none relative z-10 mt-6 max-w-xl text-[17px] leading-relaxed text-muted"
      >
        Attendance, lesson plans, skill check-offs and report cards for swim instructors. Built on the Swim for Life curriculum, and it keeps working when the pool Wi-Fi doesn’t.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.6 }}
        className="pointer-events-none relative z-10 mt-9 flex flex-wrap items-center justify-center gap-3 [&>*]:pointer-events-auto"
      >
        <ButtonLink to={signedIn ? '/app' : '/signup'} variant="primary" size="lg">
          {signedIn ? 'Open SwimTrack' : 'Start for free'} <ArrowRight size={17} />
        </ButtonLink>
        <ButtonLink to="/demo" variant="outline" size="lg">
          <Sparkles size={16} className="text-aqua" /> Try the live demo
        </ButtonLink>
      </motion.div>

      <motion.dl
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.85, duration: 0.8 }}
        className="pointer-events-none relative z-10 mt-14 grid grid-cols-3 divide-x divide-line"
      >
        {[
          [LEVELS.length, 'preset levels'],
          [SKILL_COUNT, 'skills & distances'],
          [0, 'paper worksheets'],
        ].map(([n, label]) => (
          <div key={label} className="flex flex-col-reverse items-center justify-end gap-1.5 px-3 text-center sm:px-9">
            <dt className="text-[12.5px] text-dim">{label}</dt>
            <dd className="font-display text-[1.7rem] font-bold leading-none tracking-tight sm:text-3xl">
              <NumberTicker value={n as number} />
            </dd>
          </div>
        ))}
      </motion.dl>

      <motion.a
        href="#tour"
        aria-label="Scroll down"
        className="absolute bottom-8 z-10 text-dim"
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <ChevronDown size={22} />
      </motion.a>
    </section>
  )
}

const WORDS = ['length', 'lesson', 'skill', 'swimmer']

/** Cycles the headline noun. The wrapper animates to each word's measured width so the comma glides along. */
function RotatingWord() {
  const [i, setI] = useState(0)
  const [widths, setWidths] = useState<number[]>([])
  const measure = useRef<HTMLSpanElement>(null)
  const reduced = useReducedMotion()

  useLayoutEffect(() => {
    const el = measure.current
    if (!el) return
    const read = () => setWidths([...el.children].map((c) => (c as HTMLElement).getBoundingClientRect().width))
    read()
    void document.fonts?.ready.then(read)
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (reduced) return
    const id = setInterval(() => setI((x) => (x + 1) % WORDS.length), 2800)
    return () => clearInterval(id)
  }, [reduced])

  return (
    <motion.span className="relative inline-block" animate={widths[i] ? { width: widths[i] } : undefined} transition={{ type: 'spring', stiffness: 220, damping: 28 }}>
      <span ref={measure} className="invisible absolute left-0 top-0 flex whitespace-nowrap">
        {WORDS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={WORDS[i]}
          className="text-gradient inline-block"
          initial={{ opacity: 0, y: '0.4em', filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: '-0.4em', filter: 'blur(10px)' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {WORDS[i]}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  )
}

function Tour() {
  return (
    <section id="tour" className="relative mx-auto max-w-5xl scroll-mt-24 px-4 pt-20">
      <Showcase />
    </section>
  )
}

function SkillMarquee() {
  const all = LEVELS.flatMap((l) => l.skills.filter((s) => /crawl|kick|stroke|tread|dive|float|glide/i.test(s.name)).map((s) => s.name))
  const rows = [all.filter((_, i) => i % 2 === 0).slice(0, 26), all.filter((_, i) => i % 2 === 1).slice(0, 26)]
  return (
    <section className="mask-fade-x mt-24 space-y-3 overflow-hidden" aria-label="Some of the skills SwimTrack tracks">
      {rows.map((row, r) => (
        <div key={r} className={`flex w-max gap-3 [--marquee-duration:70s] [--marquee-gap:0.75rem] hover:[animation-play-state:paused] ${r ? 'animate-marquee-reverse' : 'animate-marquee'}`}>
          {[...row, ...row].map((s, i) => (
            <span key={i} className="whitespace-nowrap rounded-xl border border-line bg-panel/70 px-3.5 py-2 text-[13px] text-muted">
              {s}
            </span>
          ))}
        </div>
      ))}
    </section>
  )
}

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-24 px-4 pt-32">
      <SectionTitle icon={<Waves size={22} />} title={<>Built for the deck, <Serif>not the desk.</Serif></>}>
        Big tap targets, zero loading spinners and everything a Swim for Life instructor fills in by hand, done in seconds.
      </SectionTitle>
      <div className="mt-14 grid gap-4 md:grid-cols-6">
        <Bento className="md:col-span-2" icon={<CloudOff size={18} />} title="Offline first" body="Saves on your phone instantly and syncs when you’re back on Wi-Fi.">
          <LiveSync />
        </Bento>
        <Bento className="md:col-span-2" icon={<CalendarCheck size={18} />} title="Lesson plans that line up" body="Set the dates once, then give every lesson a topic and notes.">
          <LiveLessons />
        </Bento>
        <Bento className="md:col-span-2" icon={<Fingerprint size={18} />} title="Two-factor sign-in" body="Protect your roster with any authenticator app.">
          <LiveTwoFactor />
        </Bento>
        <Bento className="md:col-span-6" icon={<Layers size={18} />} title="Every level, preloaded" body={`Parent & Tot through Bronze Star, plus Teen/Adult: ${LEVELS.length} levels and ${SKILL_COUNT} skills with distances. Customise any class without touching the presets.`}>
          <LevelCloud />
        </Bento>
      </div>
    </section>
  )
}

function Bento({ icon, title, body, children, className = '' }: { icon: ReactNode; title: string; body: string; children: ReactNode; className?: string }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={`card spotlight flex flex-col overflow-hidden p-6 ${className}`}
    >
      <div className="relative flex items-center gap-2.5">
        <span className="icon-tile size-9 !rounded-xl !shadow-none">{icon}</span>
        <h3 className="text-[16px] font-semibold tracking-tight">{title}</h3>
      </div>
      <p className="relative mt-3 max-w-md text-[14px] leading-relaxed text-muted">{body}</p>
      <div className="relative mt-6 flex-1">{children}</div>
    </motion.article>
  )
}

function Audience() {
  const cols = [
    {
      icon: <Waves size={20} />,
      who: 'For instructors',
      title: 'Thirty seconds on deck, not thirty minutes at home.',
      points: ['Attendance in two taps, even with no Wi-Fi', 'Every Swim for Life level, skill and distance preloaded', 'Report card comments built from the manual’s own wording', 'Big targets that work with wet hands'],
    },
    {
      icon: <Building2 size={20} />,
      who: 'For supervisors and cities',
      title: 'Every instructor’s cards look and read the same.',
      points: ['The manual’s rules checked before a card prints', 'Letter-size cards with the next level already filled in', 'Runs on your own server, in the region you choose', 'No ads, no tracking, delete anything any time'],
    },
  ]
  return (
    <section className="mx-auto max-w-6xl px-4 pt-36">
      <SectionTitle icon={<Users size={22} />} title={<>Quick on deck. <Serif>Consistent at the front desk.</Serif></>}>
        One place for the whole session, from the first lesson to the report card handed to a parent.
      </SectionTitle>
      <div className="mt-14 grid gap-4 md:grid-cols-2">
        {cols.map((c, i) => (
          <motion.article
            key={c.who}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="card p-7 sm:p-8"
          >
            <div className="flex items-center gap-3 text-[14px] font-semibold text-muted">
              <span className="icon-tile size-10 !rounded-xl !shadow-none">{c.icon}</span>
              {c.who}
            </div>
            <h3 className="mt-5 font-display text-[1.45rem] font-bold leading-snug tracking-tight">{c.title}</h3>
            <ul className="mt-5 space-y-2.5">
              {c.points.map((pt) => (
                <li key={pt} className="flex gap-3 text-[14.5px] leading-snug text-muted">
                  <Check size={16} strokeWidth={2.75} className="mt-0.5 shrink-0 text-aqua" />
                  {pt}
                </li>
              ))}
            </ul>
          </motion.article>
        ))}
      </div>
    </section>
  )
}

const STORY = [
  {
    when: 'Before the first lesson',
    title: 'Pick a level, add the roster',
    body: 'Choose Swimmer 3 and its skills, distances and must-sees come with it. Add swimmers once; they carry over to next session.',
    visual: 'levels',
  },
  {
    when: 'Every lesson, on deck',
    title: 'Everyone’s here, then the exceptions',
    body: 'One tap marks the class present, a second tap catches the late one. Check skills off in a single pass while they swim.',
    visual: 'attendance',
  },
  {
    when: 'Last week of the session',
    title: 'Report cards that follow the manual',
    body: 'Tap what they nailed and what to work on. The comment writes itself, and SwimTrack flags anything the manual doesn’t allow.',
    visual: 'rules',
  },
  {
    when: 'Hand-off',
    title: 'Print the whole class',
    body: 'Letter-size cards with incomplete items highlighted and the next level filled in, ready for the front desk.',
    visual: 'print',
  },
] as const

function SessionStory() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 70%', 'end 60%'] })
  const fill = useTransform(scrollYProgress, [0, 1], [0, 1])
  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-24 px-4 pt-36">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-12 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="md:sticky md:top-32 md:self-start">
          <SectionTitle align="left" icon={<Route size={22} />} title={<>How a session <Serif>works.</Serif></>}>
            Eight lessons, one app, zero paper worksheets. Here’s what an instructor actually does.
          </SectionTitle>
        </div>
        <div ref={ref} className="relative">
          <div className="absolute bottom-6 left-[1.1rem] top-6 w-px bg-line" aria-hidden>
            <motion.div style={{ scaleY: fill }} className="h-full w-full origin-top bg-gradient-to-b from-aqua to-blue" />
          </div>
          <ol className="space-y-6">
            {STORY.map((s, i) => (
              <motion.li
                key={s.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="relative pl-14"
              >
                <span className="absolute left-0 top-5 flex size-9 items-center justify-center rounded-full border border-line-2 bg-panel font-display text-[15px] font-bold text-aqua">{i + 1}</span>
                <div className="card p-5 sm:p-6">
                  <div className="text-[12.5px] font-semibold text-aqua">{s.when}</div>
                  <h3 className="mt-1 font-display text-[1.2rem] font-bold tracking-tight">{s.title}</h3>
                  <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{s.body}</p>
                  <div className="mt-5">
                    <StoryVisual kind={s.visual} />
                  </div>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

function StoryVisual({ kind }: { kind: (typeof STORY)[number]['visual'] }) {
  if (kind === 'levels')
    return (
      <div className="flex flex-wrap gap-1.5">
        {['ps4', 'sw1', 'sw2', 'sw3', 'sw4', 'sw5'].map((id) => (
          <span key={id} className={`rounded-lg border px-2 py-1 text-[12px] font-semibold ${id === 'sw3' ? 'border-aqua/50 bg-aqua/10 text-fg' : 'border-line-2 text-dim'}`}>
            {LEVEL_BY_ID[id].short}
          </span>
        ))}
        <span className="rounded-lg px-2 py-1 text-[12px] text-dim">13 skills · 7 must-sees</span>
      </div>
    )
  if (kind === 'attendance')
    return (
      <div className="space-y-1.5">
        {[
          ['Maya Chen', 'present'],
          ['Noah Patel', 'late'],
          ['Sofia Rossi', 'present'],
        ].map(([n, v]) => (
          <div key={n} className="flex items-center gap-2.5 rounded-xl border border-line px-2.5 py-1.5 text-[13px]">
            <span className="flex-1">{n}</span>
            <span className={`flex size-6 items-center justify-center rounded-md border ${v === 'present' ? 'border-good/40 bg-good/15 text-good' : 'border-warn/40 bg-warn/15 text-warn'}`}>
              {v === 'present' ? <Check size={12} strokeWidth={3} /> : <Clock size={12} strokeWidth={3} />}
            </span>
          </div>
        ))}
      </div>
    )
  if (kind === 'rules')
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-good/45 bg-good/12 px-2.5 py-1 text-[12px] font-medium">
            <Check size={12} strokeWidth={3} /> Tread water
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-warn/50 bg-warn/12 px-2.5 py-1 text-[12px] font-medium">
            <span className="flex size-3.5 items-center justify-center rounded-full bg-fg text-[9px] font-bold text-ink">1</span> Back crawl · arms
          </span>
        </div>
        <div className="flex items-start gap-2 rounded-xl border border-warn/30 bg-warn/[0.08] px-3 py-2 text-[12.5px]">
          <AlertTriangle size={14} className="mt-px shrink-0 text-warn" /> Leave attendance and behaviour out of report cards.
        </div>
      </div>
    )
  return (
    <div className="flex flex-wrap items-end gap-2" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="w-20 rounded-md bg-white p-2 shadow-[0_8px_20px_-10px_rgb(0_0_0/0.5)]" style={{ transform: `rotate(${(i - 1) * 4}deg) translateY(${i === 1 ? -4 : 0}px)` }}>
          <div className="h-1.5 w-10 rounded bg-[#0a1020]" />
          <div className="mt-1 h-px bg-[#0a8f86]" />
          {[0, 1, 2, 3].map((r) => (
            <div key={r} className={`mt-1 h-1 rounded ${r === 2 && i !== 1 ? 'bg-[#fde68a]' : 'bg-[#e5e7eb]'}`} style={{ width: `${70 + ((r * 13 + i * 7) % 25)}%` }} />
          ))}
          <div className="mt-1.5 h-4 rounded border border-[#e5e7eb]" />
        </div>
      ))}
      <span className="ml-1 text-[12px] text-dim">Letter · one per swimmer</span>
    </div>
  )
}

function Security() {
  const items = [
    [Lock, 'Salted scrypt password hashing', 'Passwords are never stored, only a slow, salted hash.'],
    [KeyRound, 'Two-factor authentication', 'Authenticator-app codes with one-time recovery codes. Secrets are encrypted at rest.'],
    [ShieldCheck, 'Hardened sessions', 'HttpOnly, SameSite cookies, CSRF checks, rate limits and a strict CSP.'],
    [MonitorSmartphone, 'See every device', 'Review where you’re signed in and sign out anywhere, instantly.'],
    [ServerCog, 'Your data, your server', 'One server and one database you run, in the region you choose. SQLite or MongoDB.'],
    [CloudOff, 'Private by default', 'Rosters are only visible to your account. No analytics, ads or trackers.'],
  ] as const
  return (
    <section id="security" className="mx-auto max-w-6xl scroll-mt-24 px-4 pt-36">
      <div className="relative overflow-hidden rounded-[2rem] border border-line-2 bg-panel p-8 sm:p-12">
        <BorderBeam />
        <SectionTitle align="left" icon={<ShieldCheck size={22} />} title={<>Kids’ info deserves <Serif>real protection.</Serif></>}>
          Swimmer names, photos and notes are sensitive. SwimTrack treats them that way.
        </SectionTitle>
        <div className="mt-10 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(([Icon, title, body]) => (
            <div key={title} className="flex gap-3.5">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-line-2 bg-panel-2 text-aqua">
                <Icon size={16} />
              </span>
              <div>
                <h3 className="text-[15px] font-semibold">{title}</h3>
                <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{body}</p>
              </div>
            </div>
          ))}
        </div>
        <Link to="/privacy" className="relative mt-10 inline-flex items-center gap-2 text-[14px] font-semibold text-fg underline-offset-4 hover:underline">
          Read the privacy and data handling summary <ArrowRight size={15} />
        </Link>
      </div>
    </section>
  )
}

/** A bright arc that sweeps around the card's border (a spinning conic gradient masked to a 1px ring). */
function BorderBeam() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] p-px [mask:linear-gradient(#000_0_0)_content-box_exclude,linear-gradient(#000_0_0)]" aria-hidden>
      <div className="absolute left-1/2 top-1/2 aspect-square w-[160%] -translate-x-1/2 -translate-y-1/2">
        <div className="h-full w-full animate-spin-slow bg-[conic-gradient(from_0deg,transparent_0_70%,var(--color-aqua)_88%,var(--color-blue)_94%,transparent_100%)]" />
      </div>
    </div>
  )
}

const FAQ = [
  ['Is SwimTrack free?', 'Yes, for instructors: create an account and use every feature. Pools and cities can add setup, class-list imports, priority support and their own server (see Pricing). You can also self-host it: it’s a single Node server with a built-in SQLite database.'],
  ['Does it work without Wi-Fi?', 'Yes. Once you’ve opened SwimTrack on a device, the app itself is kept on it, so it opens with no signal. Every edit saves on the device first and syncs when you’re back online. The sync pill in the top bar always shows where things stand.'],
  ['Where is swimmer data stored?', 'On the server and database whoever runs SwimTrack chooses (a city can host it itself, in Canada), plus an offline copy on the instructor’s own device. Swimmer records never go to a third party. The privacy page has the details.'],
  ['Does it follow the report card manual?', 'Comments are built from the manual’s passing and not-yet-passing templates and must-sees, incomplete items are highlighted like the paper card, and SwimTrack warns when a comment names fewer than two items, mentions attendance or behaviour, or moves up a swimmer who hasn’t passed every item.'],
  ['Which programs does it cover?', `The Lifesaving Society’s Swim for Life levels (Parent & Tot, Preschool 1–5, Swimmer 1–6), Swim Patrol (Rookie, Ranger, Star), Bronze Star and Teen/Adult 1–3: ${LEVELS.length} levels in total.`],
  ['Can I change the skills?', 'Every class gets its own editable copy of its level’s skills. Rename, reorder, add or remove them without touching the presets.'],
  ['How do report cards work?', 'SwimTrack follows the manual’s passing and failing templates. Pick what the swimmer excelled at and what to work on, and it writes the comment from the official must-sees. Edit freely, then print the whole class.'],
  ['Is there a phone app?', 'You can add SwimTrack to your home screen today and it runs like an app, offline included. Native Android and iOS apps are planned.'],
]

function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-24 px-4 pt-36">
      <SectionTitle icon={<MessageCircleQuestion size={22} />} title={<>Questions, <Serif>answered.</Serif></>} />
      <div className="mt-12 divide-y divide-line rounded-3xl border border-line bg-panel">
        {FAQ.map(([q, a], i) => (
          <div key={q}>
            <button
              type="button"
              aria-expanded={open === i}
              onClick={() => setOpen(open === i ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-[15.5px] font-medium"
            >
              {q}
              <motion.span animate={{ rotate: open === i ? 45 : 0 }} className="text-2xl font-light leading-none text-muted">
                +
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {open === i && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <p className="px-6 pb-5 text-[14.5px] leading-relaxed text-muted">{a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </section>
  )
}

function FinalCta({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="relative mx-auto mt-36 max-w-6xl px-4">
      {/* isolate + mask make Safari clip the WebGL layer to the rounded corners */}
      <div className="relative isolate overflow-hidden rounded-[2rem] border border-line-2 px-6 py-20 text-center [mask-image:radial-gradient(white,black)] sm:rounded-[2.5rem] sm:py-28">
        <div className="absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
          <Caustics className="h-full w-full" soft={0.6} resolution={0.35} />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,color-mix(in_oklab,var(--color-ink)_62%,transparent),transparent_85%)]" />
        </div>
        <h2 className="text-gradient mx-auto max-w-3xl text-[clamp(2.2rem,5.5vw,4rem)] font-extrabold leading-[1.02] tracking-[-0.035em]">
          Spend the session <Serif>teaching,</Serif> not filling in paper.
        </h2>
        <p className="mx-auto mt-5 max-w-md text-[16px] leading-relaxed text-muted">Free to try. Your first class takes about a minute to set up.</p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <ButtonLink to={signedIn ? '/app' : '/signup'} variant="primary" size="lg">
            {signedIn ? 'Open SwimTrack' : 'Create your free account'} <ArrowRight size={17} />
          </ButtonLink>
          <ButtonLink to="/demo" variant="outline" size="lg">
            Try the demo
          </ButtonLink>
        </div>
      </div>
    </section>
  )
}

const FOOTER: [string, [string, string][]][] = [
  ['Product', [['Tour', '#tour'], ['How it works', '#how'], ['Features', '#features'], ['Pricing', '#pricing']]],
  ['Trust', [['Security', '#security'], ['Privacy', '/privacy'], ['FAQ', '#faq']]],
]

function Footer({ signedIn }: { signedIn: boolean }) {
  const account: [string, string][] = signedIn ? [['Open SwimTrack', '/app']] : [['Sign in', '/login'], ['Create an account', '/signup'], ['Try the demo', '/demo']]
  const link = ([label, to]: [string, string]) => (
    <li key={label}>
      {to.startsWith('#') ? (
        <a href={to} className="transition-colors hover:text-fg">
          {label}
        </a>
      ) : (
        <Link to={to} className="transition-colors hover:text-fg">
          {label}
        </Link>
      )}
    </li>
  )
  return (
    <footer className="relative mx-auto mt-32 max-w-6xl px-4 pb-10">
      <div aria-hidden className="h-px bg-gradient-to-r from-transparent via-aqua/45 to-transparent" />
      <div className="grid grid-cols-3 gap-x-4 gap-y-10 pt-14 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div className="col-span-3 md:col-span-1">
          <Link to="/" className="inline-flex items-center gap-2.5" aria-label="SwimTrack home">
            <Logo size={30} />
            <Wordmark size={17} />
          </Link>
          <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-muted">Attendance, skills and report cards for swim instructors. Built for the pool deck, signal or not.</p>
        </div>
        {FOOTER.map(([title, links]) => (
          <nav key={title} aria-label={title}>
            <h2 className="eyebrow mb-4">{title}</h2>
            <ul className="space-y-2.5 text-[14px] text-muted">{links.map(link)}</ul>
          </nav>
        ))}
        <nav aria-label="Account">
          <h2 className="eyebrow mb-4">Account</h2>
          <ul className="space-y-2.5 text-[14px] text-muted">{account.map(link)}</ul>
        </nav>
      </div>
      <div className="mt-14 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-line pt-6 text-[12.5px] text-dim">
        <p className="max-w-xl">Curriculum based on the Lifesaving Society’s Swim for Life program. Not affiliated with the Lifesaving Society.</p>
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}
          className="inline-flex items-center gap-1.5 font-medium transition-colors hover:text-fg"
        >
          Back to top <ArrowUp size={13} />
        </button>
      </div>
    </footer>
  )
}

function SectionTitle({ icon, title, children, align = 'center' }: { icon: ReactNode; title: ReactNode; children?: ReactNode; align?: 'center' | 'left' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className={`relative ${align === 'center' ? 'mx-auto text-center' : ''} max-w-2xl`}
    >
      <span className="icon-tile mb-6 size-12">{icon}</span>
      <h2 className="text-gradient text-[clamp(2.1rem,4.8vw,3.5rem)] font-extrabold leading-[1.04] tracking-[-0.035em]">{title}</h2>
      {children && <p className="mt-4 text-balance text-[16px] leading-relaxed text-muted">{children}</p>}
    </motion.div>
  )
}

function Serif({ children }: { children: ReactNode }) {
  return <span className="accent">{children}</span>
}
