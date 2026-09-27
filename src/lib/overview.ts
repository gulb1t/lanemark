import { isReportDone } from './reportRules.ts'
import { attendanceSummary, passedLevel } from './stats.ts'
import type { SwimClass } from '../types.ts'

/**
 * What a pool supervisor sees for one class: counts and shares, never a swimmer's name, marks or comments. The
 * server works these out from each instructor's synced classes, so the details never leave that account.
 */
export interface ClassProgress {
  id: string
  name: string
  levelId: string
  session: string
  swimmers: number
  skills: number
  lessons: number
  /** Dated lessons before today. */
  past: number
  /** Lessons with attendance taken for anyone. */
  taught: number
  /** Past lessons with no attendance at all. */
  missedAttendance: number
  /** Share of marked lessons attended, averaged over swimmers; null before any attendance. */
  attendanceRate: number | null
  /** Share of the swimmer-by-skill boxes filled in (passed or not yet); null with no swimmers or skills. */
  assessed: number | null
  /** Swimmers who passed every skill. */
  passed: number
  reportsDone: number
  /** Every lesson has no date, so the class can't say where it is in the session. */
  undated: boolean
}

export function classProgress(cls: SwimClass, today: string): ClassProgress {
  const swimmers = cls.enrollments.length
  let taught = 0
  let past = 0
  let missed = 0
  for (const l of cls.lessons) {
    const marked = cls.enrollments.some((e) => e.attendance[l.id])
    if (marked) taught++
    if (l.date && l.date < today) {
      past++
      if (!marked) missed++
    }
  }
  const rates = cls.enrollments.map((e) => attendanceSummary(e, cls.lessons).rate).filter((r): r is number => r !== null)
  let filled = 0
  for (const e of cls.enrollments) for (const s of cls.skills) if (e.skills[s.id]) filled++
  const boxes = swimmers * cls.skills.length
  return {
    id: cls.id,
    name: cls.name,
    levelId: cls.levelId,
    session: cls.session,
    swimmers,
    skills: cls.skills.length,
    lessons: cls.lessons.length,
    past,
    taught,
    // Attendance can't be taken for an empty class, so it isn't counted as missed.
    missedAttendance: swimmers ? missed : 0,
    attendanceRate: rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null,
    assessed: boxes ? filled / boxes : null,
    passed: cls.enrollments.filter((e) => passedLevel(e, cls.skills)).length,
    reportsDone: cls.enrollments.filter((e) => isReportDone(e, cls.skills)).length,
    undated: cls.lessons.length > 0 && cls.lessons.every((l) => !l.date),
  }
}

const clamp = (n: number) => Math.min(1, Math.max(0, n))

/** 0–1: how far through its lessons the class is (past lessons, or lessons taught if that's more). */
export function sessionProgress(p: ClassProgress): number {
  return p.lessons ? clamp(Math.max(p.past, p.taught) / p.lessons) : 0
}

/** Share of skills that should be assessed by now: none in the first quarter of the session, all by the end. */
export function expectedAssessed(p: ClassProgress): number {
  return clamp((sessionProgress(p) - 0.25) / 0.75)
}

/** Share of report cards that should be done by now: they're written over the last 40% of the session. */
export function expectedReports(p: ClassProgress): number {
  return clamp((sessionProgress(p) - 0.6) / 0.4)
}

/** Report cards are on the instructor's to-do list from 60% of the way through the session (as on the dashboard). */
export const reportsDue = (p: ClassProgress) => p.lessons > 0 && sessionProgress(p) >= 0.6

/**
 * 0–1: how caught up a class's paperwork is for where it is in the session. Equal parts: attendance taken for past
 * lessons, skills assessed as the lessons go by, and report cards finished over the last few weeks. Null for a class
 * with no swimmers, which has nothing to do yet.
 */
export function caughtUp(p: ClassProgress): number | null {
  if (!p.swimmers) return null
  const attendance = p.past ? 1 - p.missedAttendance / p.past : 1
  const wantSkills = expectedAssessed(p)
  const skills = wantSkills && p.assessed !== null ? Math.min(1, p.assessed / wantSkills) : 1
  const wantReports = expectedReports(p)
  const reports = wantReports ? Math.min(1, p.reportsDone / p.swimmers / wantReports) : 1
  return (attendance + skills + reports) / 3
}

/** Below this, a class shows up under "Needs attention". */
export const BEHIND = 0.75

export type ClassStatus = 'empty' | 'upcoming' | 'on-track' | 'behind' | 'finished'

export function classStatus(p: ClassProgress): ClassStatus {
  if (!p.swimmers) return 'empty'
  if (p.lessons && Math.max(p.past, p.taught) >= p.lessons && p.reportsDone >= p.swimmers) return 'finished'
  if (!p.past && !p.taught) return 'upcoming'
  return (caughtUp(p) ?? 1) < BEHIND || p.missedAttendance > 0 ? 'behind' : 'on-track'
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Short reasons a class is behind, most pressing first. */
export function attentionNotes(p: ClassProgress): string[] {
  if (!p.swimmers) return []
  const out: string[] = []
  if (p.missedAttendance) out.push(`No attendance for ${plural(p.missedAttendance, 'past lesson')}`)
  if (p.assessed !== null && expectedAssessed(p) - p.assessed >= 0.2) out.push(`${Math.round(p.assessed * 100)}% of skills assessed`)
  if (reportsDue(p) && p.reportsDone < p.swimmers) out.push(`${plural(p.swimmers - p.reportsDone, 'report card')} to finish`)
  if (p.undated) out.push('No lesson dates')
  return out
}

export interface GroupProgress {
  classes: number
  swimmers: number
  lessons: number
  taught: number
  missedAttendance: number
  /** Swimmer-weighted average of class attendance rates. */
  attendanceRate: number | null
  /** Share of every swimmer-by-skill box filled in. */
  assessed: number | null
  passed: number
  reportsDone: number
  /** Report cards in classes where they're on the to-do list. */
  reportsDueOf: number
  reportsDueDone: number
  /** Average over classes that have swimmers. */
  caughtUp: number | null
  behind: number
}

/** Totals for an instructor, a session or the whole pool. */
export function summarize(list: ClassProgress[]): GroupProgress {
  let swimmers = 0
  let lessons = 0
  let taught = 0
  let missed = 0
  let rateSum = 0
  let rateWeight = 0
  let filled = 0
  let boxes = 0
  let passed = 0
  let reportsDone = 0
  let dueOf = 0
  let dueDone = 0
  let behind = 0
  const scores: number[] = []
  for (const p of list) {
    swimmers += p.swimmers
    lessons += p.lessons
    taught += p.taught
    missed += p.missedAttendance
    if (p.attendanceRate !== null) {
      rateSum += p.attendanceRate * p.swimmers
      rateWeight += p.swimmers
    }
    if (p.assessed !== null) {
      filled += p.assessed * p.swimmers * p.skills
      boxes += p.swimmers * p.skills
    }
    passed += p.passed
    reportsDone += p.reportsDone
    if (reportsDue(p)) {
      dueOf += p.swimmers
      dueDone += p.reportsDone
    }
    const score = caughtUp(p)
    if (score !== null) scores.push(score)
    if (classStatus(p) === 'behind') behind++
  }
  return {
    classes: list.length,
    swimmers,
    lessons,
    taught,
    missedAttendance: missed,
    attendanceRate: rateWeight ? rateSum / rateWeight : null,
    assessed: boxes ? filled / boxes : null,
    passed,
    reportsDone,
    reportsDueOf: dueOf,
    reportsDueDone: dueDone,
    caughtUp: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    behind,
  }
}

export interface Ranked<T> {
  item: T
  rank: number
  score: number
}

/**
 * Highest score first, with standard competition ranking ("1, 2, 2, 4") on whole percents so near-identical scores
 * share a place. Items without a score (no swimmers yet) are left out. Only ever used for classes and instructors.
 */
export function rank<T>(items: T[], score: (t: T) => number | null, name: (t: T) => string): Ranked<T>[] {
  const scored = items
    .map((item) => ({ item, score: score(item) }))
    .filter((x): x is { item: T; score: number } => x.score !== null)
    .sort((a, b) => b.score - a.score || name(a.item).localeCompare(name(b.item)))
  const out: Ranked<T>[] = []
  scored.forEach((x, i) => {
    const prev = out[i - 1]
    const same = prev && Math.round(prev.score * 100) === Math.round(x.score * 100)
    out.push({ ...x, rank: same ? prev.rank : i + 1 })
  })
  return out
}
