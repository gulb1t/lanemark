import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, ChevronDown, Clock, Plus, Search, Users, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { LEVELS, LEVEL_BY_ID, PROGRAMS, categoriesOf } from '../data/curriculum'
import { ELEMENT_LABEL } from '../data/mustSees'
import { openDialog } from '../store/useUi'
import type { LevelDef, ProgramId, Skill } from '../types'

const PROGRAM_IDS = Object.keys(PROGRAMS) as ProgramId[]
const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const SKILL_TOTAL = LEVELS.reduce((n, l) => n + l.skills.length, 0)

export default function CurriculumPage() {
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(() => params.get('q') ?? '')
  const level = LEVEL_BY_ID[params.get('level') ?? ''] ?? LEVEL_BY_ID.sw1
  const [focusSkill, setFocusSkill] = useState<string | null>(null)

  const select = (id: string, skillId?: string) => {
    setParams({ level: id }, { replace: true })
    setQ('')
    setFocusSkill(skillId ?? null)
  }

  // Every query word must appear in the skill, its category or its level ("front crawl 50m").
  const hits = useMemo(() => {
    const words = q.trim().split(/\s+/).map(compact).filter(Boolean)
    if (!words.length) return null
    return LEVELS.flatMap((l) =>
      l.skills.filter((s) => words.every((w) => compact(`${s.name} ${s.category} ${l.name} ${l.short}`).includes(w))).map((s) => ({ l, s })),
    )
  }, [q])

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-1.5">Swim for Life</p>
          <h1 className="page-title">Curriculum</h1>
          <p className="mt-2 max-w-xl text-[15px] text-muted">Every level’s skills, distances and report-card must-sees. Classes get their own editable copy.</p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-dim" />
          <input className="input h-11 rounded-full pl-10 pr-10" placeholder={`Search all ${SKILL_TOTAL} skills`} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search skills" />
          {q && (
            <button type="button" aria-label="Clear search" onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-dim hover:text-fg">
              <X size={16} />
            </button>
          )}
        </div>
      </header>

      {/* Phones: swipeable level strip */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:hidden">
        {LEVELS.map((l) => (
          <LevelPill key={l.id} level={l} active={l.id === level.id && !hits} onClick={() => select(l.id)} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[17rem_1fr]">
        <nav className="hidden lg:block" aria-label="Levels">
          <div className="sticky top-24 space-y-5">
            {PROGRAM_IDS.map((p) => (
              <div key={p}>
                <div className="mb-1.5 flex items-center gap-2 px-3 text-[13px] font-semibold">
                  <span className="size-2 rounded-full" style={{ background: PROGRAMS[p].hue }} />
                  {PROGRAMS[p].label}
                </div>
                <ul>
                  {LEVELS.filter((l) => l.program === p).map((l) => {
                    const active = l.id === level.id && !hits
                    return (
                      <li key={l.id}>
                        <button
                          type="button"
                          onClick={() => select(l.id)}
                          aria-current={active ? 'page' : undefined}
                          className={`relative flex w-full items-center justify-between rounded-xl px-3 py-1.5 text-left text-[14px] transition-colors ${active ? 'text-fg' : 'text-muted hover:text-fg'}`}
                        >
                          {active && <motion.span layoutId="curriculum-level" className="absolute inset-0 rounded-xl bg-fg/[0.06]" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                          <span className="relative truncate">{l.name.replace(/^Swimmer \d+: /, '')}</span>
                          <span className="relative ml-2 shrink-0 text-xs tabular-nums text-dim">{l.skills.length}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <AnimatePresence mode="wait">
          {hits ? (
            <motion.section key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="card overflow-hidden" aria-live="polite">
              <div className="border-b border-line px-5 py-3.5 text-sm text-muted">
                {hits.length} skill{hits.length === 1 ? '' : 's'} match “{q}”
              </div>
              <ul className="divide-y divide-line">
                {hits.slice(0, 80).map(({ l, s }) => (
                  <li key={s.id}>
                    <button type="button" onClick={() => select(l.id, s.id)} className="group flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-fg/[0.03]">
                      <span className="w-12 shrink-0 text-xs font-semibold" style={{ color: PROGRAMS[l.program].hue }}>
                        {l.short}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14.5px]">{s.name}</span>
                        <span className="block truncate text-xs text-dim">
                          {l.name} · {s.category}
                        </span>
                      </span>
                      <ArrowRight size={15} className="shrink-0 text-dim transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </li>
                ))}
                {!hits.length && <li className="px-5 py-12 text-center text-sm text-muted">No skills match. Try fewer words.</li>}
              </ul>
            </motion.section>
          ) : (
            <LevelDetail key={level.id} level={level} focusSkill={focusSkill} onSelect={select} />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function LevelPill({ level, active, onClick }: { level: LevelDef; active: boolean; onClick: () => void }) {
  const hue = PROGRAMS[level.program].hue
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [active])
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${active ? 'border-transparent text-ink' : 'border-line-2 text-muted'}`}
      style={active ? { background: hue } : undefined}
    >
      {level.short}
    </button>
  )
}

function LevelDetail({ level, focusSkill, onSelect }: { level: LevelDef; focusSkill: string | null; onSelect: (id: string) => void }) {
  const hue = PROGRAMS[level.program].hue
  const next = level.next ? LEVEL_BY_ID[level.next] : undefined
  const categories = categoriesOf(level.skills)
  const withNotes = level.skills.filter((s) => s.mustSees).length

  return (
    <motion.article initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} className="min-w-0 space-y-4">
      <div className="card overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(180deg, color-mix(in oklab, ${hue} 12%, transparent), transparent 55%)` }} />
        <div className="relative flex flex-wrap items-start justify-between gap-5 p-6">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold" style={{ color: hue }}>
              {PROGRAMS[level.program].label} · {level.short}
            </p>
            <h2 className="mt-1 text-[1.9rem] leading-tight">{level.name}</h2>
            <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted">{level.blurb}</p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-muted">
              <span className="flex items-center gap-1.5">
                <Users size={14} /> {level.ages}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={14} /> {level.minutes} min lessons
              </span>
              <span>
                {level.skills.length} skills{withNotes ? ` · ${withNotes} with must-sees` : ''}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => openDialog('newClass', level.id)}>
              Start a class
            </Button>
            {next && (
              <button type="button" onClick={() => onSelect(next.id)} className="flex items-center gap-1 text-[13px] text-muted transition-colors hover:text-fg">
                Next: {next.name} <ArrowRight size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {categories.map((cat) => {
        const skills = level.skills.filter((s) => s.category === cat)
        return (
          <section key={cat} className="card overflow-hidden">
            <h3 className="flex items-center justify-between border-b border-line px-5 py-3 text-[14px] font-semibold">
              {cat}
              <span className="text-xs font-normal text-dim">{skills.length}</span>
            </h3>
            <ol className="divide-y divide-line">
              {skills.map((s) => (
                <SkillRow key={s.id} skill={s} n={level.skills.indexOf(s) + 1} focused={s.id === focusSkill} />
              ))}
            </ol>
          </section>
        )
      })}
    </motion.article>
  )
}

function SkillRow({ skill, n, focused }: { skill: Skill; n: number; focused: boolean }) {
  const [open, setOpen] = useState(focused && Boolean(skill.mustSees))
  const ref = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [focused])
  const entries = Object.entries(skill.mustSees ?? {})

  return (
    <li ref={ref} className={focused ? 'bg-aqua/[0.06]' : ''}>
      <button
        type="button"
        disabled={!entries.length}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={entries.length ? open : undefined}
        className="flex w-full items-center gap-4 px-5 py-3 text-left transition-colors enabled:hover:bg-fg/[0.025]"
      >
        <span className="w-5 shrink-0 text-right text-xs tabular-nums text-dim">{n}</span>
        <span className="flex-1 text-[14.5px] leading-snug">{skill.name}</span>
        {entries.length > 0 && <ChevronDown size={16} className={`shrink-0 text-dim transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <dl className="grid gap-x-8 gap-y-3 px-5 pb-4 pl-14 sm:grid-cols-2">
              {entries.map(([el, text]) => (
                <div key={el}>
                  <dt className="text-xs font-semibold text-dim">{ELEMENT_LABEL[el]}</dt>
                  <dd className="mt-0.5 text-[13.5px] leading-relaxed text-muted">{text}</dd>
                </div>
              ))}
            </dl>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}
