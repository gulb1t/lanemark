import { describe, expect, it } from 'vitest'
import { LEVEL_BY_ID } from '../data/curriculum'
import { availableElements, draftComment, generateComment, plainSkillName, skillPhrase, skillWords, suggestFocus, suggestPraise, suggestReport } from './report'

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
    expect(text).toContain('When doing your front crawl, blow bubbles while your face is in')
    expect(text).toContain('Also, for your back crawl, keep your body on its back the whole way.')
    expect(text).toContain('Great job with your back whip kick!')
    expect(text).toMatch(/Best of luck next session\. You were a pleasure to teach!$/)
    // Report cards never say "Nice try" / "better luck next time".
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
    expect(text).toContain('For the next level, continue to work on your back crawl. ')
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

describe('wording for every skill', () => {
  const sw = (id: string) => LEVEL_BY_ID[id].skills
  const find = (level: string, prefix: string) => sw(level).find((s) => s.name.startsWith(prefix))!

  it('uses verb phrases where "your ___" would sound wrong', () => {
    expect(skillWords('Face in water')).toEqual({ noun: '', verb: 'putting your face in the water' })
    expect(skillWords('Tread water 30 sec.')).toEqual({ noun: 'treading', verb: 'treading water' })
    expect(skillWords('Contacting EMS').verb).toBe('calling EMS')
    expect(skillPhrase('Submerge')).toBe('going underwater')
    expect(skillPhrase('Hold tot on front, eye contact')).toBe('front hold')
    expect(skillPhrase('Flutter kick on back 5 m; reverse direction and flutter kick on front 5 m')).toBe('back-to-front flutter kick')
    expect(skillPhrase('Eggbeater kick on back or scissor kick on side, 10–15 m')).toBe('eggbeater or scissor kick')
  })

  /** The first level with a skill whose name matches, and that skill. */
  const anywhere = (re: RegExp) => {
    const level = Object.values(LEVEL_BY_ID).find((l) => l.skills.some((s) => re.test(s.name)))!
    return { skills: level.skills, skill: level.skills.find((s) => re.test(s.name))! }
  }

  it('praises verb-only skills without "your"', () => {
    const { skills, skill: face } = anywhere(/^face in water/i)
    const text = generateComment({ name: 'Ava', passed: false, praiseSkillId: face.id, focus: [], skills })
    expect(text).toContain('Great job putting your face in the water!')
  })

  it('says "When treading water" rather than "When doing your treading"', () => {
    const tread = find('sw3', 'Tread water')
    const text = generateComment({ name: 'Maya', passed: false, focus: [{ skillId: tread.id, element: 'arms' }], skills: sw('sw3') })
    expect(text).toContain('When treading water, keep your arms')
    expect(text).not.toContain('doing your treading')
  })

  it('lets must-sees that set their own scene stand alone', () => {
    const self = anywhere(/^self rescue/i)
    const egg = find('ta3', 'Eggbeater kick on back or scissor')
    const selfText = generateComment({ name: 'Sam', passed: false, focus: [{ skillId: self.skill.id, element: availableElements(self.skill)[0] }], skills: self.skills })
    expect(selfText).toContain('Good effort this session, Sam. When doing your self-rescues, make sure')
    const text = generateComment({ name: 'Sam', passed: true, focus: [{ skillId: find('ta3', 'Legs-only').id, element: 'body' }, { skillId: egg.id, element: 'legs' }], skills: sw('ta3') })
    expect(text).toContain(' For eggbeater, alternate both legs')
    expect(text).not.toMatch(/for your [^,]+, for /i)
  })

  it('capitalises the name', () => {
    expect(generateComment({ name: 'maya lee', passed: true, focus: [], skills: [] })).toMatch(/^Great job this session, Maya!/)
  })

  // Every must-see in every level, in both templates and both positions, plus praise for every skill.
  it('reads cleanly for every combination in the curriculum', () => {
    const problems: string[] = []
    const rules: [RegExp, string][] = [
      [/\b(\w+) \1\b/i, 'doubled word'],
      [/\byour [a-z]+ing (your|the|in|from|a)\b/i, '"your" before a verb phrase'],
      [/\bdoing your (going|putting|opening|moving|jumping|calling|rolling|holding|blowing|treading|swimming|giving|treating|caring|recognizing|using|removing|assessing|kicking|sculling|sprinting)\b/i, '"doing your" before a verb'],
      [/\.\.|,,|\s[,.!]|,\.|:\s*$/, 'punctuation'],
      [/[.!?] [a-z]/, 'sentence starts lower-case'],
      [/undefined|null|NaN|\$\d/, 'template leak'],
      [/\bfor your [^,.]+, for\b/i, 'double "for"'],
      [/\bwhen doing your [^,.]+, when\b/i, 'double "when"'],
      [/\b(canadian|pfd|ems|cpr|aed)\b/, 'proper noun lower-cased'],
      [/\bAlso, [^.!?]*[.!?] Also,/, 'two "Also," in a row'],
    ]
    let checked = 0
    const check = (text: string, where: string) => {
      checked++
      for (const [re, why] of rules) if (re.test(text)) problems.push(`${why} (${where}): ${text}`)
      if (!/^(Great job|Good effort) this session, [A-Z]/.test(text)) problems.push(`opening (${where}): ${text}`)
      if (!/(Best of luck next session!|You were a pleasure to teach!)$/.test(text)) problems.push(`sign-off (${where}): ${text}`)
    }
    for (const level of Object.values(LEVEL_BY_ID)) {
      const skills = level.skills
      const other = skills.find((o) => availableElements(o).length)
      for (const s of skills) {
        for (const passed of [true, false]) check(generateComment({ name: 'Maya', passed, praiseSkillId: s.id, focus: [], skills }), `${level.id} praise ${s.name}`)
        for (const element of availableElements(s)) {
          for (const passed of [true, false]) {
            for (const first of [true, false]) {
              const focus = [{ skillId: s.id, element }]
              if (other && other.id !== s.id) focus.splice(first ? 1 : 0, 0, { skillId: other.id, element: availableElements(other)[0] })
              check(generateComment({ name: 'Maya', passed, praiseSkillId: other?.id, focus, skills }), `${level.id} ${passed ? 'pass' : 'fail'} ${s.name} ${element}`)
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(1500)
    expect(problems).toEqual([])
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
