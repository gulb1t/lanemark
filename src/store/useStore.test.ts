import { beforeEach, describe, expect, it } from 'vitest'
import { buildDemoData } from '../lib/demo'
import { attendanceSummary, passedLevel, skillProgress } from '../lib/stats'
import { parseBackup, useStore } from './useStore'

const s = () => useStore.getState()

beforeEach(() => s().clearAll())

function setup(lessonCount = 6) {
  const classId = s().addClass({ levelId: 'sw3', session: 'Spring 2026', schedule: 'Tue 5:30 PM', lessonCount })
  const a = s().addSwimmer({ name: 'Maya Chen' }, classId)
  const b = s().addSwimmer({ name: 'Noah Patel' }, classId)
  const cls = () => s().classes.find((c) => c.id === classId)!
  return { classId, a, b, cls }
}

describe('classes and lessons', () => {
  it('creates a class with the requested lessons and an independent copy of the preset skills', () => {
    const { cls } = setup(8)
    expect(cls().lessons).toHaveLength(8)
    expect(cls().skills.length).toBeGreaterThan(10)
    expect(cls().name).toBe('Swimmer 3 · Tue 5:30 PM')
  })

  it('clamps lesson counts and prunes attendance when lessons are removed', () => {
    const { classId, a, cls } = setup(6)
    const last = cls().lessons[5].id
    s().setAttendance(classId, a, last, 'present')
    s().setLessonCount(classId, 4)
    expect(cls().lessons).toHaveLength(4)
    expect(cls().enrollments[0].attendance[last]).toBeUndefined()
    s().setLessonCount(classId, 0)
    expect(cls().lessons).toHaveLength(1)
    s().setLessonCount(classId, 999)
    expect(cls().lessons).toHaveLength(30)
  })

  it('renumbers by removing a middle lesson and never drops below one lesson', () => {
    const { classId, cls } = setup(2)
    const [first, second] = cls().lessons
    s().removeLesson(classId, first.id)
    expect(cls().lessons.map((l) => l.id)).toEqual([second.id])
    s().removeLesson(classId, second.id)
    expect(cls().lessons).toHaveLength(1)
  })
})

describe('skills', () => {
  it('editing the preset copy does not touch the preset', () => {
    const { classId, cls } = setup()
    const first = cls().skills[0]
    s().updateSkill(classId, first.id, { name: 'Renamed' })
    const other = s().addClass({ levelId: 'sw3', session: '', schedule: '', lessonCount: 4 })
    expect(s().classes.find((c) => c.id === other)!.skills[0].name).not.toBe('Renamed')
  })

  it('adds a skill next to its category, and removing a skill clears its marks', () => {
    const { classId, a, cls } = setup()
    s().addSkill(classId, { name: 'Front crawl, 50 m', category: 'Movement & Swimming' })
    const added = cls().skills.find((k) => k.name === 'Front crawl, 50 m')!
    const idx = cls().skills.indexOf(added)
    expect(cls().skills[idx - 1].category).toBe('Movement & Swimming')
    expect(cls().skills[idx + 1]?.category).not.toBe('Movement & Swimming')
    s().setSkillStatus(classId, a, added.id, 'pass')
    s().removeSkill(classId, added.id)
    expect(cls().enrollments[0].skills[added.id]).toBeUndefined()
  })

  it('moves a skill only within its own category', () => {
    const { classId, cls } = setup()
    const firstOfCategory = (cat: string) => cls().skills.find((k) => k.category === cat)!
    const skill = firstOfCategory('Movement & Swimming')
    const before = cls().skills.map((k) => k.id)
    s().moveSkill(classId, skill.id, -1) // already first in its category: no-op
    expect(cls().skills.map((k) => k.id)).toEqual(before)
    s().moveSkill(classId, skill.id, 1)
    const after = cls().skills
    expect(after.filter((k) => k.category === 'Movement & Swimming')[1].id).toBe(skill.id)
  })

  it('reorders one category by drag and drop without moving the others', () => {
    const { classId, cls } = setup()
    const before = cls().skills
    const cat = 'Movement & Swimming'
    const ids = before.filter((k) => k.category === cat).map((k) => k.id)
    s().reorderSkills(classId, cat, [...ids].reverse())
    const after = cls().skills
    expect(after.filter((k) => k.category === cat).map((k) => k.id)).toEqual([...ids].reverse())
    expect(after.map((k) => k.category)).toEqual(before.map((k) => k.category))
    // A stale or partial order is ignored rather than dropping skills.
    s().reorderSkills(classId, cat, ids.slice(1))
    expect(cls().skills).toHaveLength(before.length)
  })

  it('resets to the preset but keeps marks for skills that still exist', () => {
    const { classId, a, cls } = setup()
    const kept = cls().skills[0]
    s().setSkillStatus(classId, a, kept.id, 'pass')
    s().addSkill(classId, { name: 'Custom', category: 'Custom' })
    const custom = cls().skills.find((k) => k.name === 'Custom')!
    s().setSkillStatus(classId, a, custom.id, 'incomplete')
    s().resetSkills(classId)
    expect(cls().skills.some((k) => k.name === 'Custom')).toBe(false)
    expect(cls().enrollments[0].skills[kept.id]).toBe('pass')
    expect(cls().enrollments[0].skills[custom.id]).toBeUndefined()
  })
})

describe('roster', () => {
  it('unenrolling removes their records but keeps the swimmer; deleting removes them everywhere', () => {
    const { classId, a, b, cls } = setup()
    s().unenroll(classId, a)
    expect(cls().enrollments.map((e) => e.swimmerId)).toEqual([b])
    expect(s().swimmers.some((w) => w.id === a)).toBe(true)
    s().deleteSwimmer(b)
    expect(cls().enrollments).toHaveLength(0)
    expect(s().swimmers.some((w) => w.id === b)).toBe(false)
  })

  it('does not enrol the same swimmer twice', () => {
    const { classId, a, cls } = setup()
    s().enroll(classId, a)
    expect(cls().enrollments.filter((e) => e.swimmerId === a)).toHaveLength(1)
  })

  it('duplicates a class with roster and skills but a clean slate', () => {
    const { classId, a, cls } = setup()
    s().setAttendance(classId, a, cls().lessons[0].id, 'present')
    s().setSkillStatus(classId, a, cls().skills[0].id, 'pass')
    const copyId = s().duplicateClass(classId)!
    const copy = s().classes.find((c) => c.id === copyId)!
    expect(copy.enrollments).toHaveLength(2)
    expect(copy.enrollments[0].attendance).toEqual({})
    expect(copy.enrollments[0].skills).toEqual({})
    expect(copy.lessons.map((l) => l.id)).not.toEqual(cls().lessons.map((l) => l.id))
  })
})

describe('stats', () => {
  it('computes attendance rate over marked lessons only, counting late as attended', () => {
    const { classId, a, cls } = setup(4)
    const [l1, l2, l3] = cls().lessons
    s().setAttendance(classId, a, l1.id, 'present')
    s().setAttendance(classId, a, l2.id, 'late')
    s().setAttendance(classId, a, l3.id, 'absent')
    const sum = attendanceSummary(cls().enrollments[0], cls().lessons)
    expect(sum).toMatchObject({ present: 1, late: 1, absent: 1, marked: 3 })
    expect(sum.rate).toBeCloseTo(2 / 3)
    expect(attendanceSummary(cls().enrollments[1], cls().lessons).rate).toBeNull()
  })

  it('passes a level only when every skill is passed', () => {
    const { classId, a, cls } = setup()
    for (const k of cls().skills) s().setSkillStatus(classId, a, k.id, 'pass')
    expect(passedLevel(cls().enrollments[0], cls().skills)).toBe(true)
    s().setSkillStatus(classId, a, cls().skills[3].id, 'incomplete')
    expect(passedLevel(cls().enrollments[0], cls().skills)).toBe(false)
    expect(skillProgress(cls().enrollments[0], cls().skills).incomplete).toBe(1)
  })
})

describe('backup import', () => {
  it('merges without duplicating ids already present', () => {
    const demo = buildDemoData()
    s().importData(demo)
    s().importData(demo)
    expect(s().classes).toHaveLength(demo.classes.length)
    expect(s().swimmers).toHaveLength(demo.swimmers.length)
  })

  it('rejects files that are not backups', () => {
    expect(() => parseBackup({ hello: 'world' })).toThrow(/not a SwimTrack backup/)
    expect(() => parseBackup({ swimmers: [{ nope: 1 }], classes: [] })).toThrow(/damaged/)
    expect(parseBackup({ swimmers: [], classes: [] })).toEqual({ swimmers: [], classes: [] })
  })
})
