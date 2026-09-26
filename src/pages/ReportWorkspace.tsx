import { AnimatePresence, motion } from 'motion/react'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CloudOff,
  Copy,
  Info,
  Loader2,
  Minus,
  Printer,
  RotateCcw,
  Sparkles,
  Users,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { PrintReports, ReportSheet } from '../components/PrintReports'
import { Avatar } from '../components/ui/Avatar'
import { Button } from '../components/ui/Button'
import { Kbd, LevelChip, Segmented } from '../components/ui/bits'
import { MenuItem, Popover } from '../components/ui/Popover'
import { categoriesOf, getLevel, LEVELS } from '../data/curriculum'
import { ELEMENT_LABEL } from '../data/mustSees'
import { printReports } from '../lib/print'
import { availableElements, generateComment, plainSkillName, suggestReport, type FocusPick } from '../lib/report'
import { isReportDone, reportWarnings } from '../lib/reportRules'
import { firstName, passedLevel, skillProgress } from '../lib/stats'
import { useSession } from '../store/useSession'
import { useStore } from '../store/useStore'
import { toast, withUndo } from '../store/useUi'
import { useSync } from '../sync/engine'
import type { Element, Enrollment, LevelDef, Skill, SkillStatus, Swimmer, SwimClass } from '../types'
import NotFound from './NotFound'

const MAX_FOCUS = 3
const SHEET_W = 816 // 8.5in at 96 dpi

type Row = { e: Enrollment; swimmer: Swimmer }

/** Full-screen report card writing: checklist and comment builder on the left, the printed card on the right. */
export default function ReportWorkspace() {
  const { classId = '', swimmerId = '' } = useParams()
  const navigate = useNavigate()
  const cls = useStore((s) => s.classes.find((c) => c.id === classId))
  const swimmers = useStore((s) => s.swimmers)
  const user = useSession((s) => s.user)
  const [view, setView] = useState<'edit' | 'preview'>('edit')
  const [printScope, setPrintScope] = useState<'one' | 'all'>('all')
  const [dir, setDir] = useState(1)

  const rows = useMemo<Row[]>(() => {
    if (!cls) return []
    const byId = new Map(swimmers.map((w) => [w.id, w]))
    return cls.enrollments.map((e) => ({ e, swimmer: byId.get(e.swimmerId)! })).filter((r) => r.swimmer)
  }, [cls, swimmers])

  const index = rows.findIndex((r) => r.swimmer.id === swimmerId)
  const back = `/app/classes/${classId}?tab=reports`

  const go = (step: number) => {
    if (rows.length < 2) return
    const target = rows[(index + step + rows.length) % rows.length]
    setDir(step)
    navigate(`/app/classes/${classId}/reports/${target.swimmer.id}`, { replace: true })
  }
  const goRef = useRef(go)
  useLayoutEffect(() => {
    goRef.current = go
  })

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement
      if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || ev.metaKey || ev.ctrlKey || ev.altKey) return
      if (ev.key === 'ArrowLeft' || ev.key === 'k') goRef.current(-1)
      else if (ev.key === 'ArrowRight' || ev.key === 'j') goRef.current(1)
      else if (ev.key === 'Escape' && !document.querySelector('dialog[open], [role=dialog]')) navigate(back)
      else return
      ev.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, back])

  if (!cls) return <NotFound what="class" standalone />
  if (index === -1) return <Navigate to={back} replace />

  const current = rows[index]
  const level = getLevel(cls.levelId)
  const done = rows.filter((r) => isReportDone(r.e, cls.skills)).length
  const instructor = user ? firstName(user.name) : ''

  function print(scope: 'one' | 'all') {
    const missing = scope === 'all' ? rows.filter((r) => !r.e.comment.trim()).length : current.e.comment.trim() ? 0 : 1
    if (missing) toast(`${missing} card${missing === 1 ? ' has' : 's have'} no comment yet`, 'error')
    flushSync(() => setPrintScope(scope))
    printReports()
  }

  return (
    <div className="relative min-h-dvh">
      <div className="ambient" aria-hidden />
      <header className="no-print sticky top-0 z-30 border-b border-line bg-ink/80 backdrop-blur-xl" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-3 sm:px-5">
          <Link to={back} aria-label="Back to the class" className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-fg/[0.07] hover:text-fg">
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[12.5px] text-dim">
              <LevelChip level={level} />
              <span className="truncate">{cls.name}</span>
            </div>
            <div className="truncate font-display text-[17px] font-bold leading-tight">Report cards</div>
          </div>

          <ClassProgress rows={rows} cls={cls} current={index} done={done} onJump={(i) => go(i - index)} />

          <div className="ml-auto flex items-center gap-1.5">
            <SaveState />
            <div className="hidden items-center gap-1 sm:flex">
              <Button size="sm" variant="ghost" onClick={() => go(-1)} disabled={rows.length < 2} aria-label="Previous swimmer" aria-keyshortcuts="ArrowLeft K">
                <ChevronLeft size={16} />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => go(1)} disabled={rows.length < 2} aria-label="Next swimmer" aria-keyshortcuts="ArrowRight J">
                <ChevronRight size={16} />
              </Button>
            </div>
            <Popover
              label="Print"
              trigger={({ toggle, open }) => (
                <Button size="sm" variant="primary" icon={<Printer size={14} />} onClick={toggle} aria-expanded={open}>
                  <span className="hidden sm:inline">Print</span>
                </Button>
              )}
            >
              {(close) => (
                <>
                  <MenuItem icon={<Printer size={15} />} onSelect={() => (close(), print('one'))}>
                    {firstName(current.swimmer.name)}’s card
                  </MenuItem>
                  <MenuItem icon={<Users size={15} />} onSelect={() => (close(), print('all'))} hint={`${rows.length}`}>
                    Whole class
                  </MenuItem>
                </>
              )}
            </Popover>
          </div>
        </div>
        <div className="px-3 pb-2.5 lg:hidden">
          <Segmented
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'edit', label: 'Write' },
              { value: 'preview', label: 'Printed card' },
            ]}
          />
        </div>
      </header>

      <main className="relative z-10 mx-auto grid max-w-[1440px] grid-cols-[minmax(0,1fr)] gap-8 px-4 pb-32 pt-6 sm:px-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)] lg:pb-16">
        <div className={view === 'edit' ? '' : 'hidden lg:block'}>
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <motion.div
              key={current.swimmer.id}
              custom={dir}
              initial={{ opacity: 0, x: dir * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -24 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            >
              <SwimmerReport cls={cls} row={current} level={level} />
            </motion.div>
          </AnimatePresence>
        </div>
        <aside className={view === 'preview' ? '' : 'hidden lg:block'} aria-label="Printed card preview">
          <div className="lg:sticky lg:top-24">
            <div className="mb-3 flex items-center justify-between text-[13px] text-dim">
              <span>Printed card · letter</span>
              <span className="hidden lg:inline">
                <Kbd>←</Kbd> <Kbd>→</Kbd> to switch swimmers
              </span>
            </div>
            <PaperPreview>
              <ReportSheet cls={cls} e={current.e} swimmer={current.swimmer} instructor={instructor} />
            </PaperPreview>
          </div>
        </aside>
      </main>

      {/* Phones: thumb-reach navigation */}
      <nav className="no-print fixed inset-x-3 bottom-3 z-30 flex h-14 items-center justify-between rounded-2xl px-1.5 pill-nav sm:hidden" style={{ marginBottom: 'env(safe-area-inset-bottom)' }} aria-label="Swimmers">
        <Button variant="ghost" onClick={() => go(-1)} disabled={rows.length < 2} aria-label="Previous swimmer" icon={<ChevronLeft size={18} />} />
        <div className="text-center text-[13px]">
          <div className="font-semibold">{firstName(current.swimmer.name)}</div>
          <div className="text-[11.5px] text-dim">
            {done} of {rows.length} done
          </div>
        </div>
        <Button variant="ghost" onClick={() => go(1)} disabled={rows.length < 2} aria-label="Next swimmer" icon={<ChevronRight size={18} />} />
      </nav>

      <PrintReports cls={cls} rows={printScope === 'one' ? [current] : rows} instructor={instructor} />
    </div>
  )
}

/** "4 of 9 done", with one segment per swimmer that can be clicked to jump. */
function ClassProgress({ rows, cls, current, done, onJump }: { rows: Row[]; cls: SwimClass; current: number; done: number; onJump: (i: number) => void }) {
  return (
    <div className="mx-auto hidden min-w-0 flex-col items-center gap-1.5 md:flex">
      <div className="text-[12.5px] text-muted">
        <span className="font-semibold text-fg">{done}</span> of {rows.length} done
      </div>
      <div className="flex gap-1" role="list">
        {rows.map((r, i) => {
          const ok = isReportDone(r.e, cls.skills)
          return (
            <button
              key={r.swimmer.id}
              type="button"
              role="listitem"
              title={`${r.swimmer.name}${ok ? ' · done' : ''}`}
              aria-label={`${r.swimmer.name}${ok ? ', done' : ''}${i === current ? ', open' : ''}`}
              onClick={() => onJump(i)}
              className={`h-1.5 w-6 rounded-full transition-all ${ok ? 'bg-good' : 'bg-fg/15 hover:bg-fg/30'} ${i === current ? 'ring-2 ring-aqua ring-offset-2 ring-offset-ink' : ''}`}
            />
          )
        })}
      </div>
    </div>
  )
}

function SaveState() {
  const status = useSync((s) => s.status)
  const [label, icon] =
    status === 'saving'
      ? ['Saving…', <Loader2 key="s" size={13} className="animate-spin" />]
      : status === 'offline'
        ? ['Saved on this device', <CloudOff key="o" size={13} />]
        : status === 'error'
          ? ['Not synced yet', <AlertTriangle key="e" size={13} />]
          : [status === 'local' ? 'Saved in this browser' : 'Saved', <Check key="c" size={13} strokeWidth={3} />]
  return (
    <span className={`mr-1 hidden items-center gap-1.5 text-[12.5px] md:inline-flex ${status === 'error' ? 'text-warn' : 'text-dim'}`} role="status" aria-live="polite">
      {icon}
      {label}
    </span>
  )
}

/** Scales a letter-size sheet to the column width. */
function PaperPreview({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ scale: 0.6, height: 1056 })
  useLayoutEffect(() => {
    const measure = () => {
      if (!box.current || !sheet.current) return
      setSize({ scale: Math.min(1, box.current.clientWidth / SHEET_W), height: sheet.current.offsetHeight })
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (box.current) ro.observe(box.current)
    if (sheet.current) ro.observe(sheet.current)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={box} className="min-w-0 overflow-hidden" style={{ height: size.height * size.scale }}>
      <div ref={sheet} className="paper" style={{ transform: `scale(${size.scale})` }}>
        {children}
      </div>
    </div>
  )
}

// ── One swimmer ─────────────────────────────────────────────────────
function SwimmerReport({ cls, row, level }: { cls: SwimClass; row: Row; level: LevelDef | undefined }) {
  const { e, swimmer } = row
  const setComment = useStore((s) => s.setComment)
  const setNextLevel = useStore((s) => s.setNextLevel)
  const passed = passedLevel(e, cls.skills)
  const progress = skillProgress(e, cls.skills)
  const [picks, setPicks] = useState(() => suggestReport(cls.skills, e.skills, passed))
  const [lastWritten, setLastWritten] = useState(() => generateComment({ name: swimmer.name, passed, skills: cls.skills, ...picks }))
  const [copied, setCopied] = useState(false)

  const draft = generateComment({ name: swimmer.name, passed, skills: cls.skills, ...picks })
  // empty: nothing written yet · live: the text is exactly what the chips produced · manual: typed by hand.
  const mode = !e.comment.trim() ? 'empty' : e.comment === lastWritten ? 'live' : 'manual'
  const warnings = reportWarnings(e, cls.skills, level)
  const done = isReportDone(e, cls.skills)

  function write(text: string) {
    setLastWritten(text)
    setComment(cls.id, swimmer.id, text)
  }

  function applyPicks(next: typeof picks, isPassed = passed) {
    setPicks(next)
    if (mode !== 'manual') write(generateComment({ name: swimmer.name, passed: isPassed, skills: cls.skills, ...next }))
  }

  function onSkillChange(skillId: string, status: SkillStatus | undefined) {
    useStore.getState().setSkillStatus(cls.id, swimmer.id, skillId, status)
    if (mode !== 'live') return
    const fresh = useStore.getState().classes.find((c) => c.id === cls.id)?.enrollments.find((x) => x.swimmerId === swimmer.id)
    if (fresh) write(generateComment({ name: swimmer.name, passed: passedLevel(fresh, cls.skills), skills: cls.skills, ...picks }))
  }

  function togglePraise(skillId: string) {
    applyPicks({ ...picks, praiseSkillId: picks.praiseSkillId === skillId ? undefined : skillId })
  }

  function toggleFocus(skillId: string, element: Element) {
    const has = picks.focus.some((f) => f.skillId === skillId && f.element === element)
    let focus: FocusPick[] = has ? picks.focus.filter((f) => !(f.skillId === skillId && f.element === element)) : [...picks.focus, { skillId, element }]
    if (focus.length > MAX_FOCUS) {
      focus = focus.slice(-MAX_FOCUS)
      toast(`Up to ${MAX_FOCUS} “work on” items. Swapped out the oldest.`)
    }
    applyPicks({ ...picks, focus })
  }

  function rebuild() {
    withUndo('Comment rebuilt from your picks', () => write(draft))
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(e.comment)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      toast('Couldn’t copy. Select the text and copy it instead.', 'error')
    }
  }

  const suggestedNext = passed ? (level?.next ?? '') : cls.levelId
  const nextLevelId = e.nextLevelId || suggestedNext || 'none'

  return (
    <div className="space-y-5">
      {/* Swimmer */}
      <section className="card flex flex-wrap items-center gap-4 p-5">
        <Avatar name={swimmer.name} photo={swimmer.photo} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="page-title !text-[1.9rem]">{swimmer.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-muted">
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${passed ? 'border-good/35 bg-good/10 text-good' : 'border-warn/35 bg-warn/10 text-warn'}`}>
              {passed ? 'Passing' : 'Not yet passing'}
            </span>
            <span>
              {progress.pass}/{progress.total} passed
              {progress.incomplete > 0 && <> · <b className="font-semibold text-warn">{progress.incomplete} to work on</b></>}
              {progress.unmarked > 0 && <> · {progress.unmarked} not assessed</>}
            </span>
          </div>
        </div>
        {done && (
          <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="inline-flex items-center gap-1.5 rounded-full bg-good/12 px-3 py-1 text-[13px] font-semibold text-good">
            <CircleCheck size={15} /> Done
          </motion.span>
        )}
      </section>

      {/* Comment builder */}
      <section className="card p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[16px] font-bold">Comment</h2>
          <span className="text-xs text-dim">{passed ? 'Passing template' : 'Not-yet-passing template'}</span>
        </div>

        <ChipGroup label={passed ? 'Great job on…' : 'Great job with… (something they passed)'}>
          <PraiseChips cls={cls} e={e} selected={picks.praiseSkillId} onToggle={togglePraise} />
        </ChipGroup>

        <ChipGroup label={passed ? 'Keep working on… (for the next level)' : 'Work on… (from the manual’s must-sees)'} hint={`${picks.focus.length}/${MAX_FOCUS}`}>
          <FocusChips cls={cls} e={e} picks={picks.focus} onToggle={toggleFocus} />
        </ChipGroup>

        <div className="mt-5">
          <textarea
            className="input min-h-44 resize-y text-[14.5px] leading-relaxed"
            value={e.comment}
            onChange={(ev) => setComment(cls.id, swimmer.id, ev.target.value)}
            placeholder="Tap the chips above to build the comment, or write your own. It saves as you type."
            aria-label={`Report card comment for ${swimmer.name}`}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {mode === 'empty' && (
              <Button size="sm" variant="primary" icon={<Sparkles size={14} />} onClick={() => write(draft)}>
                Use suggested draft
              </Button>
            )}
            {mode === 'manual' && (
              <Button size="sm" icon={<RotateCcw size={14} />} onClick={rebuild}>
                Rebuild from chips
              </Button>
            )}
            {mode === 'live' && <span className="text-xs text-dim">Updates as you pick chips. Edit the text any time.</span>}
            <span className="ml-auto flex items-center gap-2">
              <span className={`text-xs tabular-nums ${e.comment.length > 700 ? 'text-warn' : 'text-dim'}`}>{e.comment.length} chars</span>
              <Button size="sm" variant="ghost" icon={copied ? <Check size={14} /> : <Copy size={14} />} onClick={copy} disabled={!e.comment}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </span>
          </div>
          {mode === 'empty' && (
            <p className="mt-3 rounded-xl border border-dashed border-line-2 px-3.5 py-3 text-[13.5px] leading-relaxed text-dim">
              <span className="font-semibold text-muted">Suggested: </span>
              {draft}
            </p>
          )}
        </div>

        <ul className="mt-4 space-y-2" aria-live="polite">
          <AnimatePresence initial={false}>
            {warnings.map((w) => (
              <motion.li
                key={w.id}
                layout
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className={`flex items-start gap-2.5 rounded-xl border px-3 py-2 text-[13px] leading-snug ${w.level === 'warn' ? 'border-warn/30 bg-warn/[0.08] text-fg' : 'border-line bg-fg/[0.03] text-muted'}`}
              >
                {w.level === 'warn' ? <AlertTriangle size={15} className="mt-px shrink-0 text-warn" /> : <Info size={15} className="mt-px shrink-0 text-dim" />}
                {w.text}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </section>

      <Checklist cls={cls} e={e} onChange={onSkillChange} />

      <section className="card p-5">
        <h2 className="text-[16px] font-bold">Next level to register in</h2>
        {level?.ageBased ? (
          <p className="mt-2 text-sm text-muted">Registration for this program is based on age.</p>
        ) : (
          <select className="input mt-3" value={nextLevelId} onChange={(ev) => setNextLevel(cls.id, swimmer.id, ev.target.value)} aria-label="Next level">
            <option value="none">No next level (program complete)</option>
            {LEVELS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
                {l.id === suggestedNext ? '  (suggested)' : ''}
              </option>
            ))}
          </select>
        )}
      </section>
    </div>
  )
}

function ChipGroup({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between text-[13px] text-muted">
        <span>{label}</span>
        {hint && <span className="text-xs tabular-nums text-dim">{hint}</span>}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function Chip({ on, tone = 'aqua', onClick, title, children, badge }: { on: boolean; tone?: 'aqua' | 'good' | 'warn'; onClick: () => void; title?: string; children: ReactNode; badge?: number }) {
  const active = { aqua: 'border-aqua/50 bg-aqua/12 text-fg', good: 'border-good/45 bg-good/12 text-fg', warn: 'border-warn/50 bg-warn/12 text-fg' }[tone]
  return (
    <button
      type="button"
      aria-pressed={on}
      title={title}
      onClick={onClick}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-[background-color,border-color,color,transform] active:scale-95 ${on ? active : 'border-line-2 text-muted hover:border-dim/60 hover:text-fg'}`}
    >
      {on && badge !== undefined ? (
        <span className="flex size-4 items-center justify-center rounded-full bg-fg text-[10px] font-bold text-ink">{badge}</span>
      ) : on ? (
        <Check size={13} strokeWidth={3} />
      ) : null}
      {children}
    </button>
  )
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function PraiseChips({ cls, e, selected, onToggle }: { cls: SwimClass; e: Enrollment; selected?: string; onToggle: (id: string) => void }) {
  const seen = new Set<string>()
  const passed = cls.skills.filter((s) => {
    const name = plainSkillName(s.name)
    if (e.skills[s.id] !== 'pass' || seen.has(name)) return false
    seen.add(name)
    return true
  })
  if (!passed.length) return <p className="text-[13px] text-dim">Mark skills as passed above to praise them here.</p>
  return (
    <>
      {passed.map((s) => (
        <Chip key={s.id} on={selected === s.id} tone="good" onClick={() => onToggle(s.id)} title={s.name}>
          {cap(plainSkillName(s.name))}
        </Chip>
      ))}
    </>
  )
}

function FocusChips({ cls, e, picks, onToggle }: { cls: SwimClass; e: Enrollment; picks: FocusPick[]; onToggle: (id: string, el: Element) => void }) {
  const [all, setAll] = useState(false)
  const commentable = cls.skills.filter((s) => availableElements(s).length)
  if (!commentable.length) return <p className="text-[13px] text-dim">This class’s skills have no must-sees. Write the comment by hand.</p>
  const incomplete = commentable.filter((s) => e.skills[s.id] === 'incomplete')
  const picked = (s: Skill, el: Element) => picks.findIndex((f) => f.skillId === s.id && f.element === el)
  const shown = all ? commentable : commentable.filter((s) => e.skills[s.id] === 'incomplete' || picks.some((f) => f.skillId === s.id))
  const hidden = commentable.length - shown.length
  const ordered = [...shown].sort((a, b) => Number(incomplete.includes(b)) - Number(incomplete.includes(a)))
  return (
    <>
      {ordered.flatMap((s) =>
        availableElements(s).map((el) => {
          const i = picked(s, el)
          const name = cap(plainSkillName(s.name))
          return (
            <Chip key={`${s.id}:${el}`} on={i !== -1} badge={i + 1} tone={incomplete.includes(s) ? 'warn' : 'aqua'} onClick={() => onToggle(s.id, el)} title={s.mustSees?.[el]}>
              {el === 'note' ? name : `${name} · ${ELEMENT_LABEL[el].toLowerCase()}`}
              {incomplete.includes(s) && i === -1 && <Minus size={12} className="text-warn" aria-label="incomplete" />}
            </Chip>
          )
        }),
      )}
      {hidden > 0 && (
        <button type="button" onClick={() => setAll(true)} className="min-h-9 rounded-full px-3 text-[13px] font-semibold text-aqua hover:underline">
          {incomplete.length ? `Other skills (${hidden})` : `Show skills (${hidden})`}
        </button>
      )}
    </>
  )
}

function Checklist({ cls, e, onChange }: { cls: SwimClass; e: Enrollment; onChange: (skillId: string, s: SkillStatus | undefined) => void }) {
  const next = (v: SkillStatus | undefined): SkillStatus | undefined => (v === undefined ? 'pass' : v === 'pass' ? 'incomplete' : undefined)
  return (
    <section className="card p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[16px] font-bold">Skills</h2>
        <span className="text-xs text-dim">Tap to cycle: passed, needs work, not assessed</span>
      </div>
      <div className="mt-3 space-y-4">
        {categoriesOf(cls.skills).map((cat) => (
          <div key={cat}>
            <h3 className="mb-1.5 text-[12.5px] font-semibold text-dim">{cat}</h3>
            <ul className="space-y-1">
              {cls.skills
                .filter((s) => s.category === cat)
                .map((s) => {
                  const v = e.skills[s.id]
                  const label = v === 'pass' ? 'passed' : v === 'incomplete' ? 'needs work' : 'not assessed'
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => onChange(s.id, next(v))}
                        aria-label={`${s.name}: ${label}. Tap to change.`}
                        className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-[14px] transition-colors ${v === 'incomplete' ? 'bg-[#fde68a]/25 hover:bg-[#fde68a]/35 dark:bg-warn/12' : 'hover:bg-fg/[0.04]'}`}
                      >
                        <motion.span
                          key={v ?? 'none'}
                          initial={{ scale: 0.6 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 600, damping: 22 }}
                          className={`flex size-6 shrink-0 items-center justify-center rounded-md border ${v === 'pass' ? 'border-good/45 bg-good/15 text-good' : v === 'incomplete' ? 'border-warn/50 bg-warn/15 text-warn' : 'border-dashed border-line-2'}`}
                        >
                          {v === 'pass' ? <Check size={13} strokeWidth={3} /> : v === 'incomplete' ? <Minus size={13} strokeWidth={3} /> : null}
                        </motion.span>
                        <span className={`flex-1 ${v === undefined ? 'text-muted' : ''}`}>{s.name}</span>
                      </button>
                    </li>
                  )
                })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
