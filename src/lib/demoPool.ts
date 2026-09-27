import { cloneSkills, LEVEL_BY_ID } from '../data/curriculum.ts'
import { addDays, isoDate, parseIso } from './dates.ts'
import { rng, seasonOf } from './demo.ts'
import { classProgress } from './overview.ts'
import { draftComment } from './report.ts'
import type { InstructorProgress, Pool, PoolMember } from '../store/usePool.ts'
import type { AttendanceStatus, Enrollment, SkillStatus, Swimmer, SwimClass } from '../types.ts'

/**
 * Made-up instructors for the demo's pool, each with their own habits so the overview and rankings have something
 * to show: one always caught up, one who forgets attendance, one who leaves report cards to the end, and so on.
 */
interface DemoCoach {
  name: string
  email: string
  role: 'supervisor' | 'instructor'
  /** Chance each past lesson has attendance taken. */
  attendance: number
  /** Skills assessed, relative to what's expected by now (1 = in step). */
  skills: number
  /** Report cards done, relative to what's expected by now. */
  reports: number
  /** [level, days from today to the class's sixth lesson, time] */
  classes: [string, number, string][]
}

const COACHES: DemoCoach[] = [
  {
    name: 'Priya Raman',
    email: 'priya.raman@example.com',
    role: 'supervisor',
    attendance: 1,
    skills: 1.2,
    reports: 1.1,
    classes: [
      ['sw5', 1, '6:00 PM'],
      ['sw6', 1, '6:45 PM'],
    ],
  },
  {
    name: 'Marcus Bell',
    email: 'marcus.bell@example.com',
    role: 'instructor',
    attendance: 0.97,
    skills: 1,
    reports: 0.9,
    classes: [
      ['ps3', 4, '9:30 AM'],
      ['ps5', 4, '10:15 AM'],
      ['sw1', 4, '11:00 AM'],
    ],
  },
  {
    name: 'Jordan Okafor',
    email: 'jordan.okafor@example.com',
    role: 'instructor',
    attendance: 0.72,
    skills: 0.9,
    reports: 0.8,
    classes: [
      ['sw2', -1, '5:00 PM'],
      ['sw4', -1, '5:45 PM'],
    ],
  },
  {
    name: 'Chloé Tremblay',
    email: 'chloe.tremblay@example.com',
    role: 'instructor',
    attendance: 1,
    skills: 0.45,
    reports: 0.3,
    classes: [
      ['pt2', 5, '9:00 AM'],
      ['ps2', 5, '9:45 AM'],
      ['sw3', 5, '10:30 AM'],
    ],
  },
  {
    name: 'Sam Haddad',
    email: 'sam.haddad@example.com',
    role: 'instructor',
    attendance: 0.93,
    skills: 1.1,
    reports: 1,
    classes: [
      ['ta2', 2, '7:30 PM'],
      ['bronze-star', 2, '8:15 PM'],
    ],
  },
  {
    name: 'Ava Lindqvist',
    email: 'ava.lindqvist@example.com',
    role: 'instructor',
    attendance: 0.99,
    skills: 0.8,
    reports: 0.7,
    classes: [
      ['sw3', 3, '4:30 PM'],
      ['sw4', 3, '5:15 PM'],
    ],
  },
]

const clamp = (n: number) => Math.min(1, Math.max(0, n))

const FIRST = [
  'Aria',
  'Leo',
  'Mila',
  'Kai',
  'Nora',
  'Eli',
  'Zara',
  'Omar',
  'Lucia',
  'Theo',
  'Isla',
  'Ravi',
  'Hana',
  'Felix',
  'Amelia',
  'Jin',
  'Sienna',
  'Mateo',
  'Layla',
  'Arjun',
  'Chloe',
  'Noah',
  'Yara',
  'Ben',
]
const LAST = ['Rossi', 'Singh', 'Nguyen', 'Kowalski', 'Haddad', 'Ferreira', 'Park', 'Mensah', 'Costa', 'Bianchi', 'Ali', 'Murphy', 'Tran', 'Silva', 'Chen', 'Russo']

/** One class, five weeks into an eight-lesson session like the demo coach's own classes, with its swimmers. */
function demoClass(coach: DemoCoach, [levelId, day, time]: DemoCoach['classes'][number], seed: number, today: string): { cls: SwimClass; swimmers: Swimmer[] } {
  const rand = rng(seed)
  const level = LEVEL_BY_ID[levelId]
  const skills = cloneSkills(levelId)
  const first = addDays(today, day - 35)
  const lessons = Array.from({ length: 8 }, (_, i) => ({ id: `l${seed}-${i}`, topic: '', date: addDays(first, i * 7), notes: '' }))
  const past = lessons.filter((l) => l.date < today)
  const taken = new Set(past.filter((_, i) => i === 0 || rand() < coach.attendance).map((l) => l.id))
  const progress = past.length / lessons.length
  const roster = 4 + Math.floor(rand() * (level.program === 'parent-tot' || level.program === 'preschool' ? 3 : 5))

  const swimmers: Swimmer[] = Array.from({ length: roster }, (_, k) => ({
    id: `demo-${seed}-${k}`,
    name: `${FIRST[Math.floor(rand() * FIRST.length)]} ${LAST[Math.floor(rand() * LAST.length)]}`,
    notes: '',
    createdAt: 0,
  }))
  const enrollments: Enrollment[] = swimmers.map((swimmer) => {
    const attendance: Record<string, AttendanceStatus> = {}
    for (const l of past) {
      if (!taken.has(l.id)) continue
      const r = rand()
      attendance[l.id] = r < 0.84 ? 'present' : r < 0.93 ? 'late' : 'absent'
    }
    const reportDone = rand() < clamp((progress - 0.6) / 0.4) * coach.reports * 1.4
    const share = reportDone ? 1 : clamp(clamp((progress - 0.25) / 0.75) * coach.skills * (0.8 + rand() * 0.4))
    const marks: Record<string, SkillStatus> = {}
    skills.slice(0, Math.round(skills.length * share)).forEach((s) => {
      marks[s.id] = rand() < 0.78 ? 'pass' : 'incomplete'
    })
    const comment = reportDone
      ? draftComment(
          swimmer.name,
          skills,
          marks,
          skills.every((s) => marks[s.id] === 'pass'),
        )
      : ''
    return { swimmerId: swimmer.id, attendance, skills: marks, comment, nextLevelId: '' }
  })

  const weekday = parseIso(first).toLocaleDateString('en-CA', { weekday: 'short' })
  const cls = {
    id: `demo-class-${seed}`,
    name: `${level.name} · ${weekday} ${time}`,
    levelId,
    session: seasonOf(today),
    schedule: `${weekday} ${time}`,
    lessons,
    skills,
    enrollments,
    createdAt: 0,
  }
  return { cls, swimmers }
}

const seedOf = (coach: number, k: number) => 101 + coach * 10 + k

const joined = (daysAgo: number, now: number) => now - daysAgo * 864e5

/** The demo coach supervises a pool of made-up instructors. Everything is generated in the browser. */
export function buildDemoPool(you: { id: string; name: string }, now = Date.now()): Pool {
  const members: PoolMember[] = [
    { id: you.id, name: you.name, email: 'demo@swimtrack.app', role: 'supervisor', joinedAt: joined(40, now), you: true },
    ...COACHES.map((c, i) => ({ id: `demo-coach-${i}`, name: c.name, email: c.email, role: c.role, joinedAt: joined(38 - i * 3, now), you: false })),
  ]
  return {
    id: 'demo-pool',
    name: 'Maple Community Centre',
    role: 'supervisor',
    shareLeaderboard: false,
    createdAt: joined(40, now),
    inviteCode: 'WAVE3K9T',
    memberCount: members.length,
    members,
  }
}

/** Progress for the demo pool: the demo coach's real (in-browser) classes plus the made-up instructors'. */
export function demoOverview(pool: Pool, yourClasses: SwimClass[], now = Date.now()) {
  const today = isoDate(new Date(now))
  const instructors: InstructorProgress[] = pool.members.map((m) => {
    if (m.you) return { id: m.id, name: m.name, role: m.role, you: true, classes: yourClasses.filter((c) => !c.archived).map((c) => classProgress(c, today)) }
    const i = Number(m.id.replace('demo-coach-', ''))
    const coach = COACHES[i]
    return {
      id: m.id,
      name: m.name,
      role: m.role,
      you: false,
      classes: coach.classes.map((spec, k) => classProgress(demoClass(coach, spec, seedOf(i, k), today).cls, today)),
    }
  })
  return { today, instructors }
}

/** A made-up instructor's class in full, as a supervisor opening it would see it. */
export function demoClassDetail(memberId: string, classId: string, now = Date.now()) {
  const i = Number(memberId.replace('demo-coach-', ''))
  const coach = COACHES[i]
  const k = coach ? coach.classes.findIndex((_, n) => `demo-class-${seedOf(i, n)}` === classId) : -1
  if (!coach || k === -1) return null
  const { cls, swimmers } = demoClass(coach, coach.classes[k], seedOf(i, k), isoDate(new Date(now)))
  return { instructor: { id: memberId, name: coach.name }, class: cls, swimmers }
}
