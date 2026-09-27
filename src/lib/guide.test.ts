import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { GUIDE, type GuideTarget } from '../data/guide'
import SHOTS from '../data/guideShots.json'
import { guidePath, isGuideTarget } from './guideLinks'
import { renderGuideMarkdown } from './guideMarkdown'
import type { SwimClass } from '../types'

describe('the guide', () => {
  it('docs/GUIDE.md matches src/data/guide.ts (run `npm run guide:md` after editing the guide)', () => {
    expect(readFileSync('docs/GUIDE.md', 'utf8')).toBe(renderGuideMarkdown(GUIDE, SHOTS))
  })

  it('has a light and a dark picture for every screenshot it uses', () => {
    for (const t of GUIDE.flatMap((s) => s.topics)) {
      if (!t.shot) continue
      expect(SHOTS, t.shot).toHaveProperty(t.shot)
      for (const theme of ['light', 'dark']) expect(existsSync(`public/guide/${t.shot}-${theme}.webp`), `${t.shot}-${theme}`).toBe(true)
    }
  })

  it('uses unique anchors', () => {
    const ids = GUIDE.flatMap((s) => [s.id, ...s.topics.map((t) => t.id)])
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('Try it links', () => {
  const lesson = (id: string, date: string) => ({ id, topic: '', date, notes: '' })
  const cls = (id: string, dates: string[], swimmers = 1, archived = false): SwimClass => ({
    id,
    name: id,
    levelId: 'sw3',
    session: 'Fall',
    schedule: '',
    archived,
    lessons: dates.map((d, i) => lesson(`${id}-l${i}`, d)),
    skills: [],
    enrollments: Array.from({ length: swimmers }, (_, i) => ({ swimmerId: `${id}-w${i}`, attendance: {}, skills: {}, comment: '', nextLevelId: '' })),
    createdAt: 0,
  })

  it('opens today’s class when there is one', () => {
    const classes = [cls('old', ['2026-09-27'], 1, true), cls('mon', ['2026-09-21']), cls('today', ['2026-09-27'])]
    expect(guidePath('attendance', classes, '2026-09-27')).toBe('/app/classes/today?tab=attendance')
    expect(guidePath('report-card', classes, '2026-09-27')).toBe('/app/classes/today/reports/today-w0')
  })

  it('falls back to a class with swimmers, then home', () => {
    expect(guidePath('skills', [cls('empty', [], 0), cls('full', [])], '2026-09-27')).toBe('/app/classes/full?tab=skills')
    expect(guidePath('lessons', [], '2026-09-27')).toBe('/app')
    expect(guidePath('pool', [])).toBe('/app/pool')
  })

  it('only accepts known targets', () => {
    const every: GuideTarget[] = GUIDE.flatMap((s) => s.topics.flatMap((t) => (t.tryIt ? [t.tryIt] : [])))
    for (const t of every) expect(isGuideTarget(t)).toBe(true)
    expect(isGuideTarget('https://evil.example')).toBe(false)
    expect(isGuideTarget(null)).toBe(false)
  })
})
