import { describe, expect, it } from 'vitest'
import { LEVEL_BY_ID } from '../data/curriculum'
import type { Enrollment } from '../types'
import { isReportDone, mentionedSkills, reportWarnings } from './reportRules'

const level = LEVEL_BY_ID.sw3
const skills = level.skills
const allPass = Object.fromEntries(skills.map((s) => [s.id, 'pass' as const]))
const enrol = (over: Partial<Enrollment> = {}): Enrollment => ({ swimmerId: 'w1', attendance: {}, skills: allPass, comment: '', nextLevelId: '', ...over })
const ids = (e: Enrollment) => reportWarnings(e, skills, level).map((w) => w.id)

describe('report card rules', () => {
  it('finds the skills a comment names, without double counting overlaps', () => {
    expect(mentionedSkills('Great job on your front crawl. For your back crawl, keep your ears in the water.', skills).sort()).toEqual(['back crawl', 'front crawl'])
    expect(mentionedSkills('Great session!', skills)).toEqual([])
  })

  it('asks for at least two items', () => {
    expect(ids(enrol({ comment: 'Great job this session, Maya! Great job on your front crawl.' }))).toContain('items')
    expect(ids(enrol({ comment: 'Great job this session, Maya! Great job on your front crawl. For your back crawl, keep your hips up.' }))).not.toContain('items')
  })

  it('flags attendance and behaviour', () => {
    expect(ids(enrol({ comment: 'Your front crawl and back crawl improved, but you missed several lessons.' }))).toContain('conduct')
    expect(ids(enrol({ comment: 'Front crawl and back crawl: great behaviour in the water.' }))).toContain('conduct')
    // The manual's own wording is fine.
    expect(ids(enrol({ comment: 'For your front crawl, be sure to focus on your arms. For your back crawl, pay attention to your kick.' }))).not.toContain('conduct')
  })

  it('catches a swimmer moving up with incomplete items, and passing wording on a failing card', () => {
    const skills1 = { ...allPass, [skills[0].id]: 'incomplete' as const }
    expect(ids(enrol({ skills: skills1, nextLevelId: 'sw4' }))).toContain('advancing')
    expect(ids(enrol({ skills: skills1, nextLevelId: 'sw3' }))).not.toContain('advancing')
    expect(ids(enrol({ skills: skills1, comment: 'Great job this session, Maya! For the next level, work on your front crawl and back crawl.' }))).toContain('template')
  })

  it('notes unassessed skills and only calls a card done when complete', () => {
    const partial = { [skills[0].id]: 'pass' as const }
    expect(ids(enrol({ skills: partial }))).toContain('unassessed')
    expect(isReportDone(enrol({ skills: partial, comment: 'x' }), skills)).toBe(false)
    expect(isReportDone(enrol({ comment: 'x' }), skills)).toBe(true)
    expect(isReportDone(enrol(), skills)).toBe(false)
  })
})
