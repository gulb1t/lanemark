import { describe, expect, it } from 'vitest'
import { attentionNotes, caughtUp, classProgress, classStatus, rank, summarize, type ClassProgress } from './overview'
import type { Enrollment, SwimClass } from '../types'

const TODAY = '2026-09-20'
const SKILLS = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: `Skill ${id}`, category: 'Swim' }))

/** Eight weekly lessons; `past` of them dated before TODAY. */
function makeClass(past: number, enrollments: Enrollment[]): SwimClass {
  const start = new Date(Date.UTC(2026, 8, 20 - past * 7))
  return {
    id: 'c1',
    name: 'Swimmer 3 · Tue',
    levelId: 'sw3',
    session: 'Fall 2026',
    schedule: 'Tue',
    lessons: Array.from({ length: 8 }, (_, i) => ({ id: `l${i}`, topic: '', notes: '', date: new Date(start.getTime() + i * 7 * 864e5).toISOString().slice(0, 10) })),
    skills: SKILLS,
    enrollments,
    createdAt: 1,
  }
}

/** A swimmer with attendance for the first `attended` lessons, `assessed` skills marked and maybe a comment. */
const kid = (attended: number, assessed: number, comment = ''): Enrollment => ({
  swimmerId: `w${Math.random()}`,
  attendance: Object.fromEntries(Array.from({ length: attended }, (_, i) => [`l${i}`, 'present'])),
  skills: Object.fromEntries(SKILLS.slice(0, assessed).map((s) => [s.id, 'pass'])),
  comment,
  nextLevelId: '',
})

describe('class progress', () => {
  it('counts lessons, attendance, skills and report cards', () => {
    const p = classProgress(makeClass(4, [kid(4, 4, 'Great work'), kid(3, 2)]), TODAY)
    expect(p).toMatchObject({ swimmers: 2, lessons: 8, past: 4, taught: 4, missedAttendance: 0, assessed: 0.75, passed: 1, reportsDone: 1 })
  })

  it('a class on schedule is fully caught up', () => {
    // Halfway: a third of skills expected, no report cards yet.
    const p = classProgress(makeClass(4, [kid(4, 2), kid(4, 2)]), TODAY)
    expect(caughtUp(p)).toBe(1)
    expect(classStatus(p)).toBe('on-track')
    expect(attentionNotes(p)).toEqual([])
  })

  it('missed attendance and unassessed skills pull the score down and explain why', () => {
    const p = classProgress(makeClass(6, [kid(3, 0), kid(3, 0)]), TODAY)
    expect(caughtUp(p)!).toBeLessThan(0.5)
    expect(classStatus(p)).toBe('behind')
    expect(attentionNotes(p)).toEqual(['No attendance for 3 past lessons', '0% of skills assessed', '2 report cards to finish'])
  })

  it('is finished once every lesson is past and every card is done', () => {
    const p = classProgress(makeClass(8, [kid(8, 4, 'Done'), kid(8, 4, 'Done')]), TODAY)
    expect(classStatus(p)).toBe('finished')
    expect(caughtUp(p)).toBe(1)
  })

  it('an empty class or one that hasn’t started has nothing to rank', () => {
    expect(caughtUp(classProgress(makeClass(4, []), TODAY))).toBeNull()
    expect(classStatus(classProgress(makeClass(4, []), TODAY))).toBe('empty')
    expect(classStatus(classProgress(makeClass(0, [kid(0, 0)]), TODAY))).toBe('upcoming')
  })
})

describe('totals and rankings', () => {
  const progress = (over: Partial<ClassProgress>): ClassProgress => ({
    id: 'x', name: 'x', levelId: 'sw3', session: 'Fall', swimmers: 4, skills: 10, lessons: 8, past: 4, taught: 4, missedAttendance: 0,
    attendanceRate: 0.9, assessed: 0.5, passed: 0, reportsDone: 0, undated: false, ...over,
  })

  it('weights attendance and assessment by swimmers', () => {
    const s = summarize([progress({ swimmers: 2, attendanceRate: 1, assessed: 1 }), progress({ swimmers: 6, attendanceRate: 0.5, assessed: 0 })])
    expect(s.attendanceRate).toBeCloseTo(0.625)
    expect(s.assessed).toBeCloseTo(0.25)
    expect(s.swimmers).toBe(8)
  })

  it('ranks highest first, ties share a place, and unscored items are left out', () => {
    const items = [
      { name: 'Bea', score: 0.9 },
      { name: 'Ann', score: 0.904 },
      { name: 'Cy', score: 0.95 },
      { name: 'Dee', score: 0.4 },
      { name: 'Eve', score: null },
    ]
    const out = rank(items, (i) => i.score, (i) => i.name)
    expect(out.map((r) => [r.item.name, r.rank])).toEqual([
      ['Cy', 1],
      ['Ann', 2],
      ['Bea', 2],
      ['Dee', 4],
    ])
  })
})
