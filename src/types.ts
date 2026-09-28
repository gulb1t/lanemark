export type ProgramId = 'parent-tot' | 'preschool' | 'swimmer' | 'patrol' | 'bronze' | 'teen-adult'

/** The parts of a stroke the report card manual writes comments about. `note` is a single free comment. */
export type Element = 'arms' | 'legs' | 'breathing' | 'body' | 'note'

/** "Must sees" from the report card manual: the phrase to use when a swimmer misses that part of a skill. */
export type MustSees = Partial<Record<Element, string>>

export interface Skill {
  id: string
  name: string
  category: string
  mustSees?: MustSees
}

export interface LevelDef {
  id: string
  program: ProgramId
  name: string
  /** Compact label for chips, e.g. "SW3". */
  short: string
  ages: string
  blurb: string
  /** Suggested lesson length in minutes. */
  minutes: number
  skills: Skill[]
  /** Level to register in when this one is passed. */
  next?: string
  /** Registration is decided by age rather than by passing (Parent & Tot). */
  ageBased?: boolean
}

export type SkillStatus = 'pass' | 'incomplete'
export type AttendanceStatus = 'present' | 'absent' | 'late'

export interface Swimmer {
  id: string
  name: string
  /** Only in data from older versions: Lanemark no longer keeps swimmer photos (Settings → Data removes them). */
  photo?: string
  notes: string
  createdAt: number
}

export interface Lesson {
  id: string
  topic: string
  /** ISO date (yyyy-mm-dd) or empty. */
  date: string
  notes: string
}

export interface Enrollment {
  swimmerId: string
  attendance: Record<string, AttendanceStatus>
  skills: Record<string, SkillStatus>
  /** Report card comment. */
  comment: string
  /** Level the swimmer should register in next; empty until decided. */
  nextLevelId: string
}

export interface SwimClass {
  id: string
  name: string
  levelId: string
  session: string
  schedule: string
  /** Past sessions are archived: kept for history, hidden from the main list. */
  archived?: boolean
  lessons: Lesson[]
  skills: Skill[]
  enrollments: Enrollment[]
  createdAt: number
}

export interface PersistedData {
  swimmers: Swimmer[]
  classes: SwimClass[]
}
