import { describe, expect, it } from 'vitest'
import { LEVEL_BY_ID } from '../data/curriculum'
import type { Swimmer, SwimClass } from '../types'
import { classCsv, csvFileName } from './csv'

const skills = LEVEL_BY_ID.sw1.skills.slice(0, 2)
const cls: SwimClass = {
  id: 'c1',
  name: 'Swimmer 1 · Tue 5:30 PM',
  levelId: 'sw1',
  session: 'Fall 2026',
  schedule: 'Tue 5:30 PM',
  createdAt: 0,
  skills,
  lessons: [
    { id: 'l1', topic: '', date: '2026-09-08', notes: '' },
    { id: 'l2', topic: '', date: '', notes: '' },
  ],
  enrollments: [
    { swimmerId: 's1', attendance: { l1: 'present', l2: 'late' }, skills: { [skills[0].id]: 'pass', [skills[1].id]: 'pass' }, comment: 'Great job, "Zoë"!\nSee you soon.', nextLevelId: '' },
    { swimmerId: 's2', attendance: { l1: 'absent' }, skills: { [skills[0].id]: 'incomplete' }, comment: '', nextLevelId: '' },
  ],
}
const swimmers = new Map<string, Swimmer>([
  ['s1', { id: 's1', name: 'Zoë Park', notes: '', createdAt: 0 }],
  ['s2', { id: 's2', name: '=HYPERLINK("x")', notes: '', createdAt: 0 }],
])

describe('classCsv', () => {
  const csv = classCsv(cls, swimmers)
  const lines = csv.replace(/^﻿/, '').trim().split('\r\n')

  it('has a row per swimmer with attendance, skills, result and next level', () => {
    expect(csv.startsWith('﻿')).toBe(true)
    expect(lines[0]).toBe(`Swimmer,Attendance %,L1 2026-09-08,L2,Skills passed,${skills.map((s) => (/[",]/.test(s.name) ? `"${s.name}"` : s.name)).join(',')},Result,Next level,Report card comment`)
    expect(lines[1]).toMatch(/^Zoë Park,100,Present,Late,2\/2,Pass,Pass,Passed,Swimmer 2,"Great job, ""Zoë""!/)
  })

  it('never lets a name run as a spreadsheet formula', () => {
    expect(csv).toContain(`"'=HYPERLINK(""x"")",0,Absent,,0/2,Incomplete,,Not yet`)
  })

  it('makes a safe file name', () => {
    expect(csvFileName({ ...cls, name: 'Swimmer 1 / Tue: 5:30' })).toBe('Swimmer 1 Tue. 5.30 - Fall 2026.csv')
  })
})
