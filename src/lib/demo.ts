import { cloneSkills, LEVEL_BY_ID } from '../data/curriculum.ts'
import { addDays, isoDate, parseIso } from './dates.ts'
import { draftComment } from './report.ts'
import type { AttendanceStatus, Enrollment, PersistedData, SkillStatus, Swimmer, SwimClass } from '../types.ts'
import { uid } from './stats.ts'

/** Small deterministic PRNG so the sample data looks the same every time it is loaded. */
export function rng(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SWIMMERS = [
  ['Maya Chen', 'Loves the diving board. Nervous about deep water.'],
  ['Noah Patel', 'Strong kicker, needs to relax on back crawl.'],
  ['Sofia Rossi', ''],
  ['Ethan Kim', 'Swims with goggles. Gets cold quickly.'],
  ['Amara Okafor', ''],
  ['Liam Nguyen', 'Second session in this level.'],
  ['Lucas Tremblay', ''],
  ['Zoe Singh', 'Parent asked about moving up to Preschool 5.'],
  ['Ava Martin', ''],
  ['Jonah Levi', 'Hesitant putting face in. Loves the kickboard.'],
  ['Priya Shah', ''],
  ['Owen MacDonald', 'Working towards Swim Patrol.'],
  ['Hana Sato', ''],
  ['Mateo García', ''],
] as const

interface ClassSpec {
  levelId: string
  time: string
  where: string
  lessons: number
  /** Days from today to the lesson at `anchor` (0 = teaching today). Lessons are a week apart. */
  offset: number
  anchor: number
  /** Lessons with attendance taken. A dated lesson in the past past this count shows up as a to-do. */
  taught: number
  roster: number[]
  /** Roster positions that have passed every skill. */
  passers: number[]
  /** Share of skills assessed for everyone else. */
  assessed: number
  /** Roster positions whose report card comment is written. */
  written: number[]
  seed: number
  topics: string[]
}

const SPECS: ClassSpec[] = [
  {
    levelId: 'sw3',
    time: '5:30 PM',
    where: 'Lane 2',
    lessons: 8,
    offset: 0,
    anchor: 5,
    taught: 5,
    roster: [0, 1, 2, 3, 4, 5],
    passers: [1],
    assessed: 0.7,
    written: [],
    seed: 11,
    topics: [
      'Assessment + kneeling dive',
      'Flutter kick, reverse direction',
      'Front crawl breathing to the side',
      'Back crawl arm recovery',
      'Whip kick on back',
      'Forward roll entry + tread water',
      'Interval training 4 × 15 m',
      'Skill check + games',
    ],
  },
  {
    levelId: 'ps4',
    time: '9:00 AM',
    where: 'Shallow end',
    lessons: 8,
    offset: 3,
    anchor: 4,
    taught: 3,
    roster: [6, 7, 8, 9],
    passers: [],
    assessed: 0.45,
    written: [],
    seed: 29,
    topics: ['Sideways entry', 'Glide on side', 'Flutter kick on front', 'Front float, recover to vertical', 'Jump into deep water'],
  },
  {
    levelId: 'sw6',
    time: '6:15 PM',
    where: 'Deep end',
    lessons: 8,
    offset: -2,
    anchor: 6,
    taught: 7,
    roster: [10, 11, 12, 13],
    passers: [1, 2],
    assessed: 1,
    written: [1, 2],
    seed: 47,
    topics: ['Stroke check', 'Front crawl 50 m', 'Back crawl 50 m', 'Breaststroke 25 m', 'Tread water 2 min', 'Interval training', 'Head-up front crawl', 'Final assessment'],
  },
]

export function buildDemoData(now = Date.now()): PersistedData {
  const swimmers: Swimmer[] = SWIMMERS.map(([name, notes]) => ({ id: uid(), name, notes, createdAt: now }))
  const today = isoDate(new Date(now))
  const classes: SwimClass[] = SPECS.map((spec, ci) => {
    const rand = rng(spec.seed)
    const skills = cloneSkills(spec.levelId)
    const level = LEVEL_BY_ID[spec.levelId]
    const anchorDate = addDays(today, spec.offset)
    const weekday = parseIso(anchorDate).toLocaleDateString('en-CA', { weekday: 'short' })
    const lessons = Array.from({ length: spec.lessons }, (_, i) => ({
      id: uid(),
      topic: spec.topics[i] ?? '',
      date: addDays(anchorDate, (i - spec.anchor) * 7),
      notes: '',
    }))
    const enrollments: Enrollment[] = spec.roster.map((si, pos) => {
      const attendance: Record<string, AttendanceStatus> = {}
      lessons.slice(0, spec.taught).forEach((l) => {
        const r = rand()
        attendance[l.id] = r < 0.82 ? 'present' : r < 0.92 ? 'late' : 'absent'
      })
      const marked: Record<string, SkillStatus> = {}
      if (spec.passers.includes(pos)) {
        for (const s of skills) marked[s.id] = 'pass'
      } else {
        const strength = 0.55 + rand() * 0.3
        const upTo = Math.max(1, Math.round(skills.length * spec.assessed))
        skills.slice(0, upTo).forEach((s) => {
          marked[s.id] = rand() < strength ? 'pass' : 'incomplete'
        })
        // Everyone who hasn't passed has at least one thing to work on.
        if (!Object.values(marked).includes('incomplete')) marked[skills[upTo - 1].id] = 'incomplete'
      }
      const e: Enrollment = { swimmerId: swimmers[si].id, attendance, skills: marked, comment: '', nextLevelId: '' }
      if (spec.written.includes(pos)) e.comment = draftComment(swimmers[si].name, skills, marked, spec.passers.includes(pos))
      return e
    })
    return {
      id: uid(),
      name: `${level.name} · ${weekday} ${spec.time}`,
      levelId: spec.levelId,
      session: seasonOf(today),
      schedule: `${weekday} ${spec.time} · ${spec.where}`,
      lessons,
      skills,
      enrollments,
      createdAt: now - ci,
    }
  })
  return { swimmers, classes }
}

export function seasonOf(iso: string) {
  const [y, m] = iso.split('-').map(Number)
  const season = m <= 3 ? 'Winter' : m <= 6 ? 'Spring' : m <= 8 ? 'Summer' : 'Fall'
  return `${season} ${y}`
}
