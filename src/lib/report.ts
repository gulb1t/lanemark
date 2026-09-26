import type { Element, Skill } from '../types.ts'
import { firstName } from './stats.ts'

/**
 * Report card comment generator following the report card guide's two templates:
 *
 *  Passing: "Great job this session, [name]. Great job on your [skill they excelled at]. For the next level,
 *            continue to work on [must see] when doing [skill]. For your [another skill] be sure to focus on
 *            [must see]. Best of luck next session!"
 *  Failing: "Good effort this session, [name]. When doing your [failed item], be sure to [must see]. Also, for
 *            your [failed item], remember to [must see]. Great job with your [item they passed]. Best of luck
 *            next session, you were a pleasure to teach!"
 *
 * The manual's must-sees are written as full instructions ("Make sure your arms…"), so they are lower-cased and
 * dropped in after the skill instead of being prefixed with "be sure to".
 */

export interface FocusPick {
  skillId: string
  element: Element
}

export interface ReportInput {
  name: string
  passed: boolean
  praiseSkillId?: string
  focus: FocusPick[]
  skills: Skill[]
}

/** Short skill name for use mid-sentence: drops distances/parentheticals and lower-cases. */
export function plainSkillName(name: string): string {
  return name
    .replace(/\s*\(.*?\)/g, '')
    .replace(/,\s*\d[\d–\-.]*\s*(m|sec\.?|min\.?)\b.*$/i, '')
    .replace(/\s+\d[\d–\-.]*\s*(m|sec\.?|min\.?)\b.*$/i, '')
    .trim()
    .replace(/^([A-Z])(?=[a-z])/, (c) => c.toLowerCase())
}

/**
 * How an instructor would say a skill mid-sentence ("Great job with your ___!"). The curriculum's item names are
 * written as checklist lines ("Tread water 30 sec.", "Glide on front, 5 m"), which read badly in a comment.
 */
const PHRASES: [RegExp, string][] = [
  [/^tread water/i, 'treading'],
  [/^(jump|wearing PFD, jump|roll) (entry )?into deep water,? (and )?tread/i, 'deep-water entry and treading'],
  [/^canadian swim to survive/i, 'Swim to Survive skills'],
  [/^water smart/i, 'Water Smart knowledge'],
  [/^back float; roll to front/i, 'back-to-front roll'],
  [/^front float; roll to back/i, 'front-to-back roll'],
  [/^wearing PFD, sideways entry/i, 'sideways entry and treading'],
  [/^(float on back|back float)/i, 'back float'],
  [/^(float on front|front float)/i, 'front float'],
  [/“pencil” floats/i, 'pencil floats'],
  [/“starfish” floats/i, 'starfish floats'],
  [/^glide on (front|back|side)/i, '$1 glide'],
  [/^flutter kick on (front|back|side)/i, '$1 flutter kick'],
  [/^whip kick on (front|back)/i, '$1 whip kick'],
  [/^whip kick in vertical position/i, 'vertical whip kick'],
  [/^lifesaving kick: eggbeater/i, 'eggbeater kick'],
  [/^lifesaving kick: (scissor|whip) kick/i, '$1 kick'],
  [/eggbeater/i, 'eggbeater kick'],
  [/^rescue with (buoyant|towing) aid/i, '$1-aid rescues'],
  [/^rescue with a partner/i, 'partner rescues'],
  [/^self rescue/i, 'self-rescue'],
  [/^(assess|assessing) .*victim/i, 'victim assessment'],
  [/^remove (conscious|unconscious) victim/i, 'victim removals'],
  [/^treat for shock/i, 'shock treatment'],
  [/^care for (bleeding|bone or joint injury|respiratory emergency)/i, 'first aid for $1'],
  [/^contacting ems/i, 'calling EMS'],
  [/^adult \/ child cpr/i, 'CPR'],
  [/^obstructed airway/i, 'obstructed airway care'],
  [/^victim recognition/i, 'victim recognition'],
  [/^defense methods/i, 'defence methods'],
  [/^head-up swim\b/i, 'head-up swimming'],
  [/^sprint (front crawl|back crawl|breaststroke)/i, '$1 sprint'],
  [/^sprint$/i, 'sprinting'],
  [/^endurance challenge/i, 'endurance swim'],
  [/^interval training/i, 'interval training'],
  [/^(kneeling|standing|shallow) dive/i, '$1 dive'],
  [/^(compact|tuck) jump/i, '$1 jump'],
  [/^jump into chest-deep water/i, 'jumping in'],
  [/^jump into deep water/i, 'deep-water jump'],
  [/^stride entry/i, 'stride entry'],
  [/^forward roll entry/i, 'forward roll entry'],
  [/^sideways entry/i, 'sideways entry'],
  [/^enter and exit/i, 'entries and exits'],
  [/^handstand/i, 'handstands'],
  [/^(front|back) somersault/i, '$1 somersaults'],
  [/^submerge/i, 'going underwater'],
  [/^blow bubbles/i, 'bubble blowing'],
  [/^face in water/i, 'putting your face in'],
  [/^hold breath/i, 'breath holding'],
  [/^open eyes/i, 'opening your eyes underwater'],
  [/^swim underwater/i, 'underwater swimming'],
  [/^recover object/i, 'object recovery'],
  [/^roll laterally back to front/i, 'rolling from back to front'],
  [/^roll laterally front to back/i, 'rolling from front to back'],
  [/^kicking on front and back/i, 'kicking'],
  [/^safe movement in shallow water/i, 'moving safely in shallow water'],
  [/^legs-only surface support/i, 'legs-only support'],
  [/^scull/i, 'sculling'],
  [/^swimming and lifesaving strokes/i, 'strokes'],
]

export function skillPhrase(name: string): string {
  const plain = plainSkillName(name)
  for (const [re, out] of PHRASES) {
    const m = plain.match(re)
    // The phrase replaces the whole item name; $1 pulls a word from it ("glide on side" → "side glide").
    if (m) return out.replace(/\$(\d)/g, (_, i: string) => (m[Number(i)] ?? '').toLowerCase())
  }
  return plain
    .replace(/,\s*(assisted|wearing PFD|with PFD|with and without PFD|return and exit).*$/i, '')
    .replace(/\s+(wearing|with) PFD.*$/i, '')
    .replace(/[:;].*$/, '')
    .trim()
}

function lowerFirst(s: string): string {
  return s.replace(/^([A-Z])(?=[a-z’'])/, (c) => c.toLowerCase())
}

function sentence(s: string): string {
  const t = s.trim()
  return /[.!?]$/.test(t) ? t : `${t}.`
}

/** Elements a skill has a must-see for, in the manual's column order. */
export function availableElements(skill: Skill): Element[] {
  const order: Element[] = ['arms', 'legs', 'breathing', 'body', 'note']
  return order.filter((e) => skill.mustSees?.[e])
}

export function defaultElement(skill: Skill): Element | undefined {
  const els = availableElements(skill)
  // Body position is the manual's most general comment; fall back to whatever exists.
  return els.includes('body') ? 'body' : els[0]
}

/** Sensible starting picks: incomplete skills first, then any skill that has must-sees. */
export function suggestFocus(skills: Skill[], status: Record<string, string | undefined>, max = 2): FocusPick[] {
  const withComments = skills.filter((s) => availableElements(s).length)
  const ordered = [
    ...withComments.filter((s) => status[s.id] === 'incomplete'),
    ...withComments.filter((s) => status[s.id] !== 'incomplete'),
  ]
  const picks: FocusPick[] = []
  for (const s of ordered) {
    const element = defaultElement(s)
    if (element) picks.push({ skillId: s.id, element })
    if (picks.length >= max) break
  }
  return picks
}

/**
 * First passed skill to praise. Prefers skills with manual comments (strokes, kicks, treading) because the
 * manual says swimmer-level cards should avoid leading with dives and jumps.
 */
export function suggestPraise(skills: Skill[], status: Record<string, string | undefined>): string | undefined {
  const passed = skills.filter((s) => status[s.id] === 'pass')
  return (passed.find((s) => availableElements(s).length) ?? passed[0])?.id
}

export function generateComment(input: ReportInput): string {
  const { name, passed, praiseSkillId, focus, skills } = input
  const byId = new Map(skills.map((s) => [s.id, s]))
  const who = firstName(name)
  const praise = praiseSkillId ? byId.get(praiseSkillId) : undefined
  const picks = focus
    .map((f) => ({ skill: byId.get(f.skillId), text: byId.get(f.skillId)?.mustSees?.[f.element] }))
    .filter((p): p is { skill: Skill; text: string } => Boolean(p.skill && p.text))

  const parts: string[] = []

  if (passed) {
    parts.push(`Great job this session, ${who}!`)
    if (praise) parts.push(`Great job on your ${skillPhrase(praise.name)}!`)
    picks.forEach((p, i) => {
      const lead = i === 0 ? `For the next level, continue to work on your ${skillPhrase(p.skill.name)}:` : `For your ${skillPhrase(p.skill.name)},`
      parts.push(`${lead} ${lowerFirst(sentence(p.text))}`)
    })
    parts.push('Best of luck next session!')
  } else {
    parts.push(`Good effort this session, ${who}.`)
    picks.forEach((p, i) => {
      // Must-sees that already start with "When…" or "If…" read badly after "When doing your…".
      const conditional = /^(when|if|as|while)\b/i.test(p.text.trim())
      const lead = i === 0 ? (conditional ? 'For your' : 'When doing your') : 'Also, for your'
      parts.push(`${lead} ${skillPhrase(p.skill.name)}, ${lowerFirst(sentence(p.text))}`)
    })
    if (praise) parts.push(`Great job with your ${skillPhrase(praise.name)}!`)
    parts.push('Best of luck next session, you were a pleasure to teach!')
  }
  return parts.join(' ')
}

/**
 * Starting picks for a report card. The praised skill is never also a focus item, and swimmers who passed get
 * pointed at their most advanced skills (the end of the list) to keep working on for the next level.
 */
export function suggestReport(skills: Skill[], status: Record<string, string | undefined>, passed: boolean) {
  const praiseSkillId = suggestPraise(skills, status)
  const pool = skills.filter((s) => s.id !== praiseSkillId)
  const focus = suggestFocus(passed ? [...pool].reverse() : pool, status)
  return { praiseSkillId, focus }
}

/** A ready-to-edit comment built from the suggested praise and focus items. */
export function draftComment(name: string, skills: Skill[], status: Record<string, string | undefined>, passed: boolean): string {
  return generateComment({ name, passed, skills, ...suggestReport(skills, status, passed) })
}
