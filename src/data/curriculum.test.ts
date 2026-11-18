import { describe, expect, it } from 'vitest'
import { LEVELS, LEVEL_BY_ID } from './curriculum'
import { MUST_SEES } from './mustSees'

describe('curriculum data', () => {
  it('has unique level ids and resolvable next levels', () => {
    const ids = LEVELS.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const l of LEVELS) if (l.next) expect(LEVEL_BY_ID[l.next], `${l.id}.next`).toBeDefined()
  })

  it('has unique skill ids within each level and no empty fields', () => {
    for (const l of LEVELS) {
      expect(l.skills.length, l.id).toBeGreaterThan(0)
      const ids = l.skills.map((s) => s.id)
      expect(new Set(ids).size, `${l.id} skill ids`).toBe(ids.length)
      for (const s of l.skills) {
        expect(s.name.trim(), s.id).not.toBe('')
        expect(s.category.trim(), s.id).not.toBe('')
      }
    }
  })

  it('keeps every must-see a finished sentence', () => {
    for (const [key, ms] of Object.entries(MUST_SEES)) {
      for (const text of Object.values(ms)) {
        expect(text, key).not.toMatch(/\[|\]/)
        expect(text.trim().length, key).toBeGreaterThan(10)
      }
    }
  })

  it('uses every must-see entry somewhere (no dead data)', () => {
    const used = new Set<string>()
    for (const l of LEVELS) for (const s of l.skills) if (s.mustSees) used.add(JSON.stringify(s.mustSees))
    const unused = Object.entries(MUST_SEES).filter(([, v]) => !used.has(JSON.stringify(v))).map(([k]) => k)
    expect(unused).toEqual([])
  })

  it('follows the official Swimmer distances', () => {
    const names = (id: string) => LEVEL_BY_ID[id].skills.map((s) => s.name)
    expect(names('sw2')).toEqual(expect.arrayContaining(['Front crawl, 10 m', 'Back crawl, 10 m']))
    expect(names('sw3')).toEqual(expect.arrayContaining(['Front crawl, 15 m', 'Back crawl, 15 m']))
    expect(names('sw4')).toEqual(expect.arrayContaining(['Front crawl, 25 m', 'Back crawl, 25 m']))
    expect(names('sw5')).toEqual(expect.arrayContaining(['Front crawl, 50 m', 'Back crawl, 50 m', 'Breaststroke, 25 m']))
    expect(names('sw6')).toEqual(expect.arrayContaining(['Front crawl, 100 m', 'Back crawl, 100 m', 'Breaststroke, 50 m']))
  })

  it('chains levels in program order and ends at Bronze Star / Teen-Adult 3', () => {
    const chain = (start: string) => {
      const out = [start]
      while (LEVEL_BY_ID[out[out.length - 1]].next) out.push(LEVEL_BY_ID[out[out.length - 1]].next!)
      return out
    }
    expect(chain('pt1')).toEqual(['pt1', 'pt2', 'pt3', 'ps1', 'ps2', 'ps3', 'ps4', 'ps5', 'sw2', 'sw3', 'sw4', 'sw5', 'sw6', 'rookie', 'ranger', 'star', 'bronze-star'])
    expect(chain('ta1')).toEqual(['ta1', 'ta2', 'ta3'])
  })
})
