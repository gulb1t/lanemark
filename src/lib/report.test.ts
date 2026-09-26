import { describe, expect, it } from 'vitest'
import { LEVEL_BY_ID } from '../data/curriculum'
import { availableElements, draftComment, generateComment, plainSkillName, skillPhrase, suggestFocus, suggestPraise, suggestReport } from './report'

describe('plainSkillName', () => {
  it('drops distances, durations and parentheticals and lower-cases the first letter', () => {
    expect(plainSkillName('Front crawl, 50 m')).toBe('front crawl')
    expect(plainSkillName('Tread water 30 sec. wearing PFD')).toBe('tread water')
    expect(plainSkillName('Float on front, 3 sec. (assisted)')).toBe('float on front')
    expect(plainSkillName('Glide on side, 3 m')).toBe('glide on side')
    expect(plainSkillName('Flutter kick on back 5 m; reverse direction and flutter kick on front 5 m')).toBe(
      'flutter kick on back',
    )
  })
})

describe('generateComment', () => {
  const sw3 = LEVEL_BY_ID.sw3.skills
  const front = sw3.find((s) => s.name === 'Front crawl, 15 m')!
  const back = sw3.find((s) => s.name === 'Back crawl, 15 m')!
  const whip = sw3.find((s) => s.name.startsWith('Whip kick'))!

  it('uses the failing template: name, failed items with must-sees, praise, sign-off', () => {
    const text = generateComment({
      name: 'Maya Chen',
      passed: false,
      praiseSkillId: whip.id,
      focus: [
        { skillId: front.id, element: 'breathing' },
        { skillId: back.id, element: 'body' },
      ],
      skills: sw3,
    })
    expect(text).toMatch(/^Good effort this session, Maya\./)
    expect(text).toContain('When doing your front crawl, ensure you are blowing bubbles')
    expect(text).toContain('Also, for your back crawl, remember to keep your body on your back.')
    expect(text).toContain('Great job with your back whip kick!')
    expect(text).toMatch(/Best of luck next session, you were a pleasure to teach!$/)
    // The manual says never to write "Nice try" / "better luck next time".
    expect(text).not.toMatch(/nice try|better luck/i)
  })

  it('uses the passing template with praise first and a next-level focus', () => {
    const text = generateComment({
      name: 'Noah Patel',
      passed: true,
      praiseSkillId: front.id,
      focus: [{ skillId: back.id, element: 'legs' }],
      skills: sw3,
    })
    expect(text).toMatch(/^Great job this session, Noah!/)
    expect(text).toContain('Great job on your front crawl!')
    expect(text).toContain('For the next level, continue to work on your back crawl:')
    expect(text).toMatch(/Best of luck next session!$/)
  })

  it('skips focus picks whose element has no must-see instead of printing "undefined"', () => {
    const text = generateComment({
      name: 'Zoe',
      passed: false,
      focus: [{ skillId: whip.id, element: 'arms' }],
      skills: sw3,
    })
    expect(text).not.toContain('undefined')
    expect(text).not.toContain('When doing your')
  })
})

describe('skillPhrase', () => {
  it('says skills the way an instructor would', () => {
    expect(skillPhrase('Tread water 30 sec.')).toBe('treading')
    expect(skillPhrase('Glide on front, 5 m')).toBe('front glide')
    expect(skillPhrase('Whip kick on back, 10 m')).toBe('back whip kick')
    expect(skillPhrase('Handstand in shallow water')).toBe('handstands')
    expect(skillPhrase('Front crawl, 15 m')).toBe('front crawl')
    expect(skillPhrase('Back float; roll to front; swim 5 m')).toBe('back-to-front roll')
  })
  it('praises with natural wording and never doubles up "when"', () => {
    const sw3 = LEVEL_BY_ID.sw3.skills
    const tread = sw3.find((s) => s.name.startsWith('Tread water'))!
    const flutter = sw3.find((s) => s.name.startsWith('Flutter kick on back'))!
    const text = generateComment({ name: 'Maya Chen', passed: false, praiseSkillId: tread.id, focus: [{ skillId: flutter.id, element: 'body' }], skills: sw3 })
    expect(text).toContain('Great job with your treading!')
    expect(text).not.toMatch(/when doing your [^,]+, when/i)
  })
})

describe('suggestions', () => {
  const skills = LEVEL_BY_ID.sw2.skills
  it('puts incomplete skills first when suggesting focus', () => {
    const back = skills.find((s) => s.name === 'Back crawl, 10 m')!
    const picks = suggestFocus(skills, { [back.id]: 'incomplete' })
    expect(picks[0].skillId).toBe(back.id)
    expect(availableElements(back)).toContain(picks[0].element)
  })
  it('suggests the first passed skill for praise', () => {
    expect(suggestPraise(skills, { [skills[2].id]: 'pass' })).toBe(skills[2].id)
    expect(suggestPraise(skills, {})).toBeUndefined()
  })
  it('prefers a stroke over a dive when suggesting praise', () => {
    const sw3 = LEVEL_BY_ID.sw3.skills
    const dive = sw3.find((s) => s.name.startsWith('Kneeling dive'))!
    const crawl = sw3.find((s) => s.name === 'Front crawl, 15 m')!
    expect(suggestPraise(sw3, { [dive.id]: 'pass', [crawl.id]: 'pass' })).toBe(crawl.id)
    // With only a dive passed, fall back to it rather than suggesting nothing.
    expect(suggestPraise(sw3, { [dive.id]: 'pass' })).toBe(dive.id)
  })
})

describe('suggestReport / draftComment', () => {
  const sw3 = LEVEL_BY_ID.sw3.skills
  const allPassed = Object.fromEntries(sw3.map((s) => [s.id, 'pass']))

  it('never praises and focuses on the same skill', () => {
    const { praiseSkillId, focus } = suggestReport(sw3, allPassed, true)
    expect(praiseSkillId).toBeDefined()
    expect(focus.map((f) => f.skillId)).not.toContain(praiseSkillId)
  })

  it('points passing swimmers at their most advanced skills', () => {
    const { focus } = suggestReport(sw3, allPassed, true)
    const names = focus.map((f) => sw3.find((s) => s.id === f.skillId)!.name)
    expect(names[0]).toMatch(/crawl/i)
  })

  it('drafts a complete failing comment around the incomplete items', () => {
    const back = sw3.find((s) => s.name === 'Back crawl, 15 m')!
    const text = draftComment('Maya Chen', sw3, { ...allPassed, [back.id]: 'incomplete' }, false)
    expect(text).toMatch(/^Good effort this session, Maya\. When doing your back crawl, /)
    expect(text).toMatch(/pleasure to teach!$/)
  })
})
