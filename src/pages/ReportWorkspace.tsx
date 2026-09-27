import { AnimatePresence, motion } from 'motion/react'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CloudOff,
  Copy,
  Eye,
  Loader2,
  PenLine,
  Printer,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { PrintReports, ReportSheet } from '../components/PrintReports'
import { Avatar } from '../components/ui/Avatar'
import { Button } from '../components/ui/Button'
import { LevelChip } from '../components/ui/bits'
import { Modal } from '../components/ui/Modal'
import { MenuItem, Popover } from '../components/ui/Popover'
import { categoriesOf, getLevel, LEVEL_BY_ID, LEVELS } from '../data/curriculum'
import { ELEMENT_LABEL } from '../data/mustSees'
import { printReports } from '../lib/print'
import { availableElements, generateComment, plainSkillName, suggestReport, type FocusPick } from '../lib/report'
import { isReportDone, reportWarnings } from '../lib/reportRules'
import { firstName, passedLevel, skillProgress } from '../lib/stats'
import { useSession } from '../store/useSession'
import { useStore } from '../store/useStore'
import { confirm, toast, withUndo } from '../store/useUi'
import { useSync } from '../sync/engine'
import type { Element, Enrollment, LevelDef, Skill, SkillStatus, Swimmer, SwimClass } from '../types'
import NotFound from './NotFound'

const MAX_FOCUS = 3
const SHEET_W = 816 // 8.5in at 96 dpi

type Row = { e: Enrollment; swimmer: Swimmer }

/**
 * Writing report cards, one swimmer at a time, in three steps: check the skills, write the comment (SwimTrack can
 * write it), confirm the next level. The printed card is one tap away under Preview.
 */
export default function ReportWorkspace() {
  const { classId = '', swimmerId = '' } = useParams()
  const navigate = useNavigate()
  const cls = useStore((s) => s.classes.find((c) => c.id === classId))
  const swimmers = useStore((s) => s.swimmers)
  const user = useSession((s) => s.user)
  const [preview, setPreview] = useState(false)
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
    window.scrollTo({ top: 0 })
  }
  const goRef = useRef(go)
  useLayoutEffect(() => {
    goRef.current = go
  })

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement
      if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || ev.metaKey || ev.ctrlKey || ev.altKey) return
      if (document.querySelector('dialog[open], [role=dialog]')) return
      if (ev.key === 'ArrowLeft' || ev.key === 'k') goRef.current(-1)
      else if (ev.key === 'ArrowRight' || ev.key === 'j') goRef.current(1)
      else if (ev.key === 'Escape') navigate(back)
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
  const next = rows[(index + 1) % rows.length]
  const prev = rows[(index - 1 + rows.length) % rows.length]

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
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-3 sm:px-5">
          <Link
            to={back}
            aria-label="Back to the class"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-fg/[0.07] hover:text-fg"
          >
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
            <Button size="sm" variant="ghost" icon={<Eye size={15} />} onClick={() => setPreview(true)} data-tour="report-preview">
              <span className="max-sm:hidden">Preview</span>
            </Button>
            <Popover
              label="Print"
              trigger={({ toggle, open }) => (
                <Button size="sm" variant="primary" icon={<Printer size={14} />} onClick={toggle} aria-expanded={open}>
                  <span className="max-sm:hidden">Print</span>
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
      </header>

      <main className="relative z-10 mx-auto max-w-3xl px-4 pb-36 pt-6 sm:px-6">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={current.swimmer.id}
            custom={dir}
            initial={{ opacity: 0, x: dir * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -24 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <SwimmerReport cls={cls} row={current} level={level} position={index + 1} total={rows.length} />
          </motion.div>
        </AnimatePresence>

        {done === rows.length && rows.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card mt-5 flex flex-wrap items-center gap-4 border-good/30 p-5">
            <span className="flex size-10 items-center justify-center rounded-full bg-good text-ink">
              <Check size={20} strokeWidth={3} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">All {rows.length} report cards are done</div>
              <div className="text-[13.5px] text-muted">Print them on letter paper, one card per page.</div>
            </div>
            <Button variant="primary" icon={<Printer size={15} />} onClick={() => print('all')}>
              Print all
            </Button>
          </motion.div>
        )}
      </main>

      {/* Moving between swimmers, always at thumb reach. */}
      <nav
        className="no-print fixed inset-x-3 bottom-3 z-30 mx-auto flex h-16 max-w-3xl items-center gap-2 rounded-2xl px-2 pill-nav"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Swimmers"
      >
        <Button variant="ghost" onClick={() => go(-1)} disabled={rows.length < 2} icon={<ChevronLeft size={18} />} aria-label={`Previous: ${prev.swimmer.name}`}>
          <span className="max-sm:hidden">{firstName(prev.swimmer.name)}</span>
        </Button>
        <div className="min-w-0 flex-1 text-center text-[13px]">
          <div className="truncate font-semibold">{current.swimmer.name}</div>
          <div className="text-[11.5px] text-dim">
            {done} of {rows.length} done
          </div>
        </div>
        <Button variant="primary" onClick={() => go(1)} disabled={rows.length < 2} data-tour="report-next">
          <span>
            Next<span className="max-sm:hidden">: {firstName(next.swimmer.name)}</span>
          </span>
          <ChevronRight size={17} />
        </Button>
      </nav>

      <Modal
        open={preview}
        onClose={() => setPreview(false)}
        title={`${current.swimmer.name}’s printed card`}
        description="This is exactly what prints, on letter paper."
        size="xl"
      >
        <PaperPreview>
          <ReportSheet cls={cls} e={current.e} swimmer={current.swimmer} instructor={instructor} />
        </PaperPreview>
      </Modal>

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
    <span className={`mr-1 hidden items-center gap-1.5 text-[12.5px] lg:inline-flex ${status === 'error' ? 'text-warn' : 'text-dim'}`} role="status" aria-live="polite">
      {icon}
      {label}
    </span>
  )
}

/** Scales a letter-size sheet to the width available. */
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
    <div ref={box} className="min-w-0 overflow-hidden rounded-lg border border-line" style={{ height: size.height * size.scale }}>
      <div ref={sheet} className="paper" style={{ transform: `scale(${size.scale})` }}>
        {children}
      </div>
    </div>
  )
}

// ── One swimmer ─────────────────────────────────────────────────────

function Step({ n, title, hint, done, children, tour }: { n: number; title: string; hint: ReactNode; done: boolean; children: ReactNode; tour?: string }) {
  return (
    <section className="card p-5 sm:p-6" data-tour={tour}>
      <div className="flex items-start gap-3.5">
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-full font-display text-[15px] font-bold transition-colors ${done ? 'bg-good text-ink' : 'bg-fg/[0.08] text-fg'}`}
          aria-hidden
        >
          {done ? <Check size={16} strokeWidth={3} /> : n}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-bold leading-tight">
            <span className="sr-only">Step {n}: </span>
            {title}
          </h2>
          <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{hint}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function SwimmerReport({ cls, row, level, position, total }: { cls: SwimClass; row: Row; level: LevelDef | undefined; position: number; total: number }) {
  const { e, swimmer } = row
  const setComment = useStore((s) => s.setComment)
  const passed = passedLevel(e, cls.skills)
  const progress = skillProgress(e, cls.skills)
  const [picks, setPicks] = useState(() => suggestReport(cls.skills, e.skills, passed))
  const [lastWritten, setLastWritten] = useState(() => generateComment({ name: swimmer.name, passed, skills: cls.skills, ...picks }))
  const [writingOwn, setWritingOwn] = useState(false)
  const [customizing, setCustomizing] = useState(false)
  const [copied, setCopied] = useState(false)
  const box = useRef<HTMLTextAreaElement>(null)
  const first = firstName(swimmer.name)

  // empty: nothing written yet · live: the text is exactly what SwimTrack wrote · manual: edited by hand.
  const mode = !e.comment.trim() ? 'empty' : e.comment === lastWritten ? 'live' : 'manual'
  const warnings = reportWarnings(e, cls.skills, level)
  const commentIssues = warnings.filter((w) => ['items', 'conduct', 'template', 'length'].includes(w.id))
  const done = isReportDone(e, cls.skills)

  function write(text: string) {
    setLastWritten(text)
    setComment(cls.id, swimmer.id, text)
  }

  const draftFor = (next: typeof picks, isPassed = passed) => generateComment({ name: swimmer.name, passed: isPassed, skills: cls.skills, ...next })

  /** New chip picks rewrite the comment, after asking if that would throw away the instructor's own edits. */
  async function applyPicks(next: typeof picks) {
    if (mode === 'manual') {
      const ok = await confirm({
        title: 'Rewrite the comment?',
        body: 'You’ve edited the comment by hand. Changing these picks writes a new one in its place.',
        confirmLabel: 'Rewrite it',
      })
      if (!ok) return
      setPicks(next)
      withUndo('Comment rewritten', () => write(draftFor(next)))
      return
    }
    setPicks(next)
    write(draftFor(next))
  }

  function onSkillChange(skillId: string, status: SkillStatus | undefined) {
    useStore.getState().setSkillStatus(cls.id, swimmer.id, skillId, status)
    if (mode !== 'live') return
    // A comment SwimTrack wrote follows the skills; one the instructor edited is left alone.
    const fresh = useStore
      .getState()
      .classes.find((c) => c.id === cls.id)
      ?.enrollments.find((x) => x.swimmerId === swimmer.id)
    if (fresh) write(draftFor(picks, passedLevel(fresh, cls.skills)))
  }

  async function passRemaining() {
    const left = cls.skills.filter((s) => !e.skills[s.id])
    const ok = await confirm({
      title: `Mark ${left.length} skill${left.length === 1 ? '' : 's'} as passed?`,
      body: `Every skill you haven’t checked for ${first} will be marked Passed. Skills marked Not yet stay as they are.`,
      confirmLabel: 'Mark as passed',
    })
    if (!ok) return
    withUndo(`${left.length} skill${left.length === 1 ? '' : 's'} passed`, () => {
      for (const s of left) onSkillChange(s.id, 'pass')
    })
  }

  function writeForMe() {
    const fresh = suggestReport(cls.skills, e.skills, passed)
    setPicks(fresh)
    write(draftFor(fresh))
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

  return (
    <div className="space-y-4">
      <section className="flex items-center gap-4 px-1">
        <Avatar name={swimmer.name} photo={swimmer.photo} size={56} />
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-medium text-dim">
            Card {position} of {total}
          </div>
          <h1 className="page-title truncate !text-[1.9rem] max-sm:!text-[1.5rem]">{swimmer.name}</h1>
        </div>
        {done ? (
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-good/12 px-3 py-1 text-[13px] font-semibold text-good"
          >
            <CircleCheck size={15} /> Done
          </motion.span>
        ) : (
          <span className="shrink-0 rounded-full bg-fg/[0.06] px-3 py-1 text-[13px] font-medium text-muted">Not done</span>
        )}
      </section>

      <Step
        n={1}
        title="Check their skills"
        tour="report-skills"
        done={progress.unmarked === 0}
        hint={
          <>
            Tap <b className="font-semibold text-fg">Passed</b> or <b className="font-semibold text-fg">Not yet</b> for each skill. Tap again to undo.
          </>
        }
      >
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
          <span className="font-semibold text-good">{progress.pass} passed</span>
          {progress.incomplete > 0 && <span className="font-semibold text-warn">{progress.incomplete} not yet</span>}
          {progress.unmarked > 0 && <span className="text-muted">{progress.unmarked} to check</span>}
          {progress.unmarked > 0 && (
            <button type="button" onClick={passRemaining} className="ml-auto text-[13px] font-semibold text-aqua hover:underline">
              Pass the rest
            </button>
          )}
        </div>
        <Checklist cls={cls} e={e} onChange={onSkillChange} />
      </Step>

      <Step
        n={2}
        title="Write the comment"
        tour="report-comment"
        done={Boolean(e.comment.trim()) && !commentIssues.some((w) => w.level === 'warn')}
        hint={
          mode === 'empty' ? 'SwimTrack can write it from the skills above, in the report card manual’s own words.' : 'Edit it as much as you like. It saves as you type.'
        }
      >
        {mode === 'empty' && !writingOwn ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-2 px-4 py-7 text-center">
            <Button variant="primary" size="lg" icon={<Sparkles size={17} />} onClick={writeForMe}>
              Write it for me
            </Button>
            <button
              type="button"
              onClick={() => {
                flushSync(() => setWritingOwn(true))
                box.current?.focus()
              }}
              className="text-[13.5px] font-medium text-muted underline-offset-4 hover:text-fg hover:underline"
            >
              or write my own
            </button>
          </div>
        ) : (
          <>
            <textarea
              ref={box}
              className="input min-h-44 resize-y text-[15px] leading-relaxed"
              value={e.comment}
              onChange={(ev) => setComment(cls.id, swimmer.id, ev.target.value)}
              placeholder={`Write ${first}’s comment. Mention at least two skills.`}
              aria-label={`Report card comment for ${swimmer.name}`}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button size="sm" variant="ghost" icon={<PenLine size={14} />} onClick={() => setCustomizing((v) => !v)} aria-expanded={customizing}>
                Change what it says
                <ChevronDown size={14} className={`transition-transform ${customizing ? 'rotate-180' : ''}`} />
              </Button>
              <span className="ml-auto flex items-center gap-2">
                <span className={`text-xs tabular-nums ${e.comment.length > 700 ? 'text-warn' : 'text-dim'}`}>{e.comment.length} characters</span>
                <Button size="sm" variant="ghost" icon={copied ? <Check size={14} /> : <Copy size={14} />} onClick={copy} disabled={!e.comment}>
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </span>
            </div>

            <AnimatePresence initial={false}>
              {customizing && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="mt-3 space-y-4 rounded-2xl bg-fg/[0.03] p-4">
                    <ChipGroup label={`Praise ${first} for`} hint="Pick one">
                      <PraiseChips
                        cls={cls}
                        e={e}
                        selected={picks.praiseSkillId}
                        onToggle={(id) => applyPicks({ ...picks, praiseSkillId: picks.praiseSkillId === id ? undefined : id })}
                      />
                    </ChipGroup>
                    <ChipGroup label={passed ? `Tips for the next level` : `What ${first} should work on`} hint={`${picks.focus.length} of ${MAX_FOCUS}`}>
                      <FocusChips
                        cls={cls}
                        e={e}
                        picks={picks.focus}
                        onToggle={(skillId, element) => {
                          const has = picks.focus.some((f) => f.skillId === skillId && f.element === element)
                          let focus: FocusPick[] = has
                            ? picks.focus.filter((f) => !(f.skillId === skillId && f.element === element))
                            : [...picks.focus, { skillId, element }]
                          if (focus.length > MAX_FOCUS) {
                            focus = focus.slice(-MAX_FOCUS)
                            toast(`Up to ${MAX_FOCUS} things to work on. Swapped out the oldest.`)
                          }
                          void applyPicks({ ...picks, focus })
                        }}
                      />
                    </ChipGroup>
                    <p className="text-[12.5px] text-dim">The comment is rewritten each time you change a pick.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <CommentChecks issues={commentIssues} hasComment={Boolean(e.comment.trim())} />
          </>
        )}
      </Step>

      <NextLevelStep cls={cls} e={e} swimmer={swimmer} level={level} passed={passed} progressIncomplete={progress.incomplete} />
    </div>
  )
}

/** The manual's rules, shown as a short checklist once there's a comment. */
function CommentChecks({ issues, hasComment }: { issues: ReturnType<typeof reportWarnings>; hasComment: boolean }) {
  if (!hasComment) return null
  if (!issues.length)
    return (
      <p className="mt-3 flex items-center gap-2 rounded-xl bg-good/[0.08] px-3 py-2 text-[13px] text-good">
        <Check size={15} strokeWidth={3} /> Follows the manual: mentions two or more skills, and no attendance or behaviour.
      </p>
    )
  return (
    <ul className="mt-3 space-y-2" aria-live="polite">
      {issues.map((w) => (
        <li
          key={w.id}
          className={`flex items-start gap-2.5 rounded-xl border px-3 py-2 text-[13px] leading-snug ${w.level === 'warn' ? 'border-warn/30 bg-warn/[0.08] text-fg' : 'border-line bg-fg/[0.03] text-muted'}`}
        >
          <AlertTriangle size={15} className={`mt-px shrink-0 ${w.level === 'warn' ? 'text-warn' : 'text-dim'}`} />
          {w.text}
        </li>
      ))}
    </ul>
  )
}

function NextLevelStep({
  cls,
  e,
  swimmer,
  level,
  passed,
  progressIncomplete,
}: {
  cls: SwimClass
  e: Enrollment
  swimmer: Swimmer
  level: LevelDef | undefined
  passed: boolean
  progressIncomplete: number
}) {
  const setNextLevel = useStore((s) => s.setNextLevel)
  const [changing, setChanging] = useState(false)
  const first = firstName(swimmer.name)
  const suggested = passed ? (level?.next ?? '') : cls.levelId
  const chosen = e.nextLevelId || suggested || 'none'
  const name = chosen === 'none' ? null : (LEVEL_BY_ID[chosen]?.name ?? null)
  const advancing = level?.next && e.nextLevelId === level.next && progressIncomplete > 0

  return (
    <Step
      n={3}
      title="Next level"
      done
      hint={
        level?.ageBased
          ? 'Registration for this program is based on age, so there’s nothing to choose.'
          : passed
            ? `${first} passed every skill, so they move up.`
            : `${first} hasn’t passed every skill yet, so they repeat the level. That’s the manual’s rule.`
      }
    >
      {!level?.ageBased && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-xl bg-fg/[0.05] px-3.5 py-2 text-[15px] font-semibold">{name ? `Register in ${name}` : 'Program complete'}</span>
          {!changing ? (
            <button type="button" onClick={() => setChanging(true)} className="text-[13.5px] font-medium text-muted underline-offset-4 hover:text-fg hover:underline">
              Change
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <select className="input h-10 w-auto" value={chosen} onChange={(ev) => setNextLevel(cls.id, swimmer.id, ev.target.value)} aria-label="Next level" autoFocus>
                <option value="none">No next level (program complete)</option>
                {LEVELS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                    {l.id === suggested ? '  (suggested)' : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setChanging(false)}
                aria-label="Done changing"
                className="inline-flex size-9 items-center justify-center rounded-full text-dim hover:bg-fg/[0.06] hover:text-fg"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>
      )}
      {advancing && (
        <p className="mt-3 flex items-start gap-2.5 rounded-xl border border-warn/30 bg-warn/[0.08] px-3 py-2 text-[13px] leading-snug">
          <AlertTriangle size={15} className="mt-px shrink-0 text-warn" />
          Moving up with {progressIncomplete} skill{progressIncomplete === 1 ? '' : 's'} not yet passed. The manual says every skill must be passed first.
        </p>
      )}
    </Step>
  )
}

function ChipGroup({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[13px] font-medium">
        <span>{label}</span>
        {hint && <span className="text-xs font-normal tabular-nums text-dim">{hint}</span>}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function Chip({
  on,
  tone = 'aqua',
  onClick,
  title,
  children,
  badge,
}: {
  on: boolean
  tone?: 'aqua' | 'good' | 'warn'
  onClick: () => void
  title?: string
  children: ReactNode
  badge?: number
}) {
  const active = { aqua: 'border-aqua/50 bg-aqua/12 text-fg', good: 'border-good/45 bg-good/12 text-fg', warn: 'border-warn/50 bg-warn/12 text-fg' }[tone]
  return (
    <button
      type="button"
      aria-pressed={on}
      title={title}
      onClick={onClick}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-[background-color,border-color,color,transform] active:scale-95 ${on ? active : 'border-line-2 bg-panel text-muted hover:border-dim/60 hover:text-fg'}`}
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
  if (!passed.length) return <p className="text-[13px] text-dim">Mark some skills Passed in step 1 to praise them here.</p>
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
  if (!commentable.length) return <p className="text-[13px] text-dim">This class’s skills have no manual wording to use. Write the comment by hand.</p>
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
            <Chip
              key={`${s.id}:${el}`}
              on={i !== -1}
              badge={i + 1}
              tone={incomplete.includes(s) ? 'warn' : 'aqua'}
              onClick={() => onToggle(s.id, el)}
              title={s.mustSees?.[el]}
            >
              {el === 'note' ? name : `${name}: ${ELEMENT_LABEL[el].toLowerCase()}`}
            </Chip>
          )
        }),
      )}
      {hidden > 0 && (
        <button type="button" onClick={() => setAll(true)} className="min-h-9 rounded-full px-3 text-[13px] font-semibold text-aqua hover:underline">
          {incomplete.length ? `More skills (${hidden})` : `Show skills (${hidden})`}
        </button>
      )}
    </>
  )
}

/** Each skill with two plain buttons: Passed and Not yet. Tapping the one that's on clears it. */
function Checklist({ cls, e, onChange }: { cls: SwimClass; e: Enrollment; onChange: (skillId: string, s: SkillStatus | undefined) => void }) {
  return (
    <div className="space-y-4">
      {categoriesOf(cls.skills).map((cat) => (
        <div key={cat}>
          <h3 className="mb-1 text-[12px] font-semibold uppercase tracking-wider text-dim">{cat}</h3>
          <ul className="divide-y divide-line">
            {cls.skills
              .filter((s) => s.category === cat)
              .map((s) => {
                const v = e.skills[s.id]
                return (
                  <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
                    <span className={`min-w-0 flex-1 basis-48 text-[14.5px] ${v === undefined ? 'text-fg' : v === 'pass' ? 'text-muted' : 'text-fg'}`}>{s.name}</span>
                    <div className="flex shrink-0 gap-1.5" role="group" aria-label={s.name}>
                      <button
                        type="button"
                        aria-pressed={v === 'pass'}
                        onClick={() => onChange(s.id, v === 'pass' ? undefined : 'pass')}
                        className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors active:scale-95 ${v === 'pass' ? 'border-good bg-good text-ink' : 'border-line-2 text-muted hover:border-good/60 hover:text-good'}`}
                      >
                        <Check size={14} strokeWidth={3} /> Passed
                      </button>
                      <button
                        type="button"
                        aria-pressed={v === 'incomplete'}
                        onClick={() => onChange(s.id, v === 'incomplete' ? undefined : 'incomplete')}
                        className={`inline-flex h-9 items-center rounded-full border px-3.5 text-[13px] font-semibold transition-colors active:scale-95 ${v === 'incomplete' ? 'border-warn bg-warn text-ink' : 'border-line-2 text-muted hover:border-warn/60 hover:text-warn'}`}
                      >
                        Not yet
                      </button>
                    </div>
                  </li>
                )
              })}
          </ul>
        </div>
      ))}
    </div>
  )
}
