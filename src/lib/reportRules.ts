import type { Enrollment, LevelDef, Skill } from '../types'
import { plainSkillName, skillPhrase } from './report'
import { passedLevel, skillProgress } from './stats'

/**
 * Checks a report card against the report card guidelines:
 *  - comment on at least two items,
 *  - never mention attendance or behaviour,
 *  - a swimmer passes a level only when every item is passed.
 */

export interface ReportWarning {
  id: string
  /** 'warn' breaks a rule in the manual; 'info' is worth a look but fine to print. */
  level: 'warn' | 'info'
  text: string
}

// Words that signal attendance or behaviour. "focus" and "attention" are left out on purpose: the manual's own
// templates use them for skills ("be sure to focus on…").
const CONDUCT =
  /\b(attend(?:ance|ed|ing)?|absen(?:t|ce|ces)|missed (?:a |some |several |many )?(?:class|classes|lesson|lessons)|tard(?:y|iness)|late to|behaviou?r(?:al|s)?|misbehav\w*|disruptive|disrupting|rude(?:ness)?|attitude|listening|did not listen|didn’t listen|horsing around|goofing)\b/i

/** Distinct class skills a comment talks about, matched by their short names ("front crawl", "tread water"). */
export function mentionedSkills(comment: string, skills: Skill[]): string[] {
  const text = comment.toLowerCase()
  const names = new Set<string>()
  for (const s of skills) {
    // Comments use either the item name ("tread water") or how instructors say it ("treading").
    for (const n of [plainSkillName(s.name), skillPhrase(s.name)]) {
      const name = n.toLowerCase()
      if (name.length >= 4 && text.includes(name)) names.add(skillPhrase(s.name).toLowerCase())
    }
  }
  // "front crawl" and "front crawl kick" both match "front crawl kick"; keep only the longest.
  return [...names].filter((n) => ![...names].some((m) => m !== n && m.includes(n)))
}

export function reportWarnings(e: Enrollment, skills: Skill[], level: LevelDef | undefined): ReportWarning[] {
  const out: ReportWarning[] = []
  const comment = e.comment.trim()
  const passed = passedLevel(e, skills)
  const progress = skillProgress(e, skills)

  if (comment) {
    const items = mentionedSkills(comment, skills).length
    if (items < 2) out.push({ id: 'items', level: 'warn', text: `Comment on at least two items. This mentions ${items === 0 ? 'none' : 'one'} by name.` })
    const conduct = comment.match(CONDUCT)
    if (conduct) out.push({ id: 'conduct', level: 'warn', text: `Leave attendance and behaviour out of report cards (“${conduct[0]}”).` })
    if (!passed && /\b(for the next level|great job this session)\b/i.test(comment)) {
      out.push({ id: 'template', level: 'warn', text: 'This uses the passing wording, but the swimmer hasn’t passed every item yet.' })
    }
    if (comment.length > 700) out.push({ id: 'length', level: 'info', text: 'Long comments may not fit in the box on the printed card.' })
  }

  if (!level?.ageBased && progress.incomplete > 0 && level?.next && e.nextLevelId === level.next) {
    out.push({
      id: 'advancing',
      level: 'warn',
      text: `Registered for the next level with ${progress.incomplete} incomplete item${progress.incomplete === 1 ? '' : 's'}. Swimmers must pass every item to move up.`,
    })
  }
  if (progress.unmarked > 0) {
    out.push({ id: 'unassessed', level: 'info', text: `${progress.unmarked} skill${progress.unmarked === 1 ? ' isn’t' : 's aren’t'} assessed yet.` })
  }
  return out
}

/** A card is done once every skill is assessed and the comment is written. */
export function isReportDone(e: Enrollment, skills: Skill[]) {
  return Boolean(e.comment.trim()) && skillProgress(e, skills).unmarked === 0
}
