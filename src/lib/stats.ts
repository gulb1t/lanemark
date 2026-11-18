import type { Enrollment, Lesson, Skill, SwimClass } from '../types.ts'

export const uid = () => crypto.randomUUID()

export interface SkillProgress {
  pass: number
  incomplete: number
  unmarked: number
  total: number
  /** 0–1 share of skills passed. */
  ratio: number
}

export function skillProgress(enrollment: Enrollment, skills: Skill[]): SkillProgress {
  let pass = 0
  let incomplete = 0
  for (const s of skills) {
    const v = enrollment.skills[s.id]
    if (v === 'pass') pass++
    else if (v === 'incomplete') incomplete++
  }
  const total = skills.length
  return { pass, incomplete, unmarked: total - pass - incomplete, total, ratio: total ? pass / total : 0 }
}

export interface AttendanceSummary {
  present: number
  late: number
  absent: number
  /** Lessons with any mark. */
  marked: number
  /** 0–1 share of marked lessons attended (present or late); null when nothing is marked yet. */
  rate: number | null
}

export function attendanceSummary(enrollment: Enrollment, lessons: Lesson[]): AttendanceSummary {
  let present = 0
  let late = 0
  let absent = 0
  for (const l of lessons) {
    const v = enrollment.attendance[l.id]
    if (v === 'present') present++
    else if (v === 'late') late++
    else if (v === 'absent') absent++
  }
  const marked = present + late + absent
  return { present, late, absent, marked, rate: marked ? (present + late) / marked : null }
}

/** Per-lesson headcount across a class roster. */
export function lessonHeadcount(cls: SwimClass, lessonId: string) {
  let present = 0
  let late = 0
  let absent = 0
  for (const e of cls.enrollments) {
    const v = e.attendance[lessonId]
    if (v === 'present') present++
    else if (v === 'late') late++
    else if (v === 'absent') absent++
  }
  return { present, late, absent, marked: present + late + absent }
}

/** A swimmer passes a level only when every skill is passed. */
export function passedLevel(enrollment: Enrollment, skills: Skill[]): boolean {
  return skills.length > 0 && skills.every((s) => enrollment.skills[s.id] === 'pass')
}

export interface ClassSummary {
  swimmers: number
  lessons: number
  /** Average attendance rate across swimmers that have marks; null if none. */
  attendanceRate: number | null
  /** Average share of skills passed across swimmers; null with no swimmers. */
  skillRatio: number | null
}

export function classSummary(cls: SwimClass): ClassSummary {
  const rates = cls.enrollments
    .map((e) => attendanceSummary(e, cls.lessons).rate)
    .filter((r): r is number => r !== null)
  const ratios = cls.enrollments.map((e) => skillProgress(e, cls.skills).ratio)
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
  return {
    swimmers: cls.enrollments.length,
    lessons: cls.lessons.length,
    attendanceRate: avg(rates),
    skillRatio: avg(ratios),
  }
}

export const pct = (n: number | null) => (n === null ? '—' : `${Math.round(n * 100)}%`)

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

/**
 * The parts of a class's schedule its name doesn't already say. Unnamed classes are called "Swimmer 3 · Tue 5:30 PM",
 * so repeating "Tue 5:30 PM" underneath is noise; "Tue 5:30 PM · Lane 2" becomes just "Lane 2".
 */
export function scheduleNote(cls: { name: string; schedule: string }): string {
  const name = cls.name.toLowerCase()
  return cls.schedule
    .split(/\s*·\s*/)
    .filter((part) => part && !name.includes(part.toLowerCase()))
    .join(' · ')
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'Swimmer'
}
