import type { Swimmer, SwimClass } from '../types.ts'
import { nextLevelLabel } from './print.ts'
import { attendanceSummary, passedLevel, skillProgress } from './stats.ts'

/** Quotes a cell when it needs it. A leading = + - @ is prefixed so spreadsheets never run a name as a formula. */
function cell(value: string | number): string {
  let s = String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const ATTENDANCE = { present: 'Present', late: 'Late', absent: 'Absent' } as const
const SKILL = { pass: 'Pass', incomplete: 'Incomplete' } as const

/**
 * One class as a spreadsheet: a row per swimmer with attendance for every lesson, each skill, the result, the
 * next level and the report card comment. Opens in Excel, Numbers and Google Sheets.
 */
export function classCsv(cls: SwimClass, swimmers: Map<string, Swimmer>): string {
  const lessonHeads = cls.lessons.map((l, i) => `L${i + 1}${l.date ? ` ${l.date}` : ''}`)
  const header = ['Swimmer', 'Attendance %', ...lessonHeads, 'Skills passed', ...cls.skills.map((s) => s.name), 'Result', 'Next level', 'Report card comment']
  const rows = cls.enrollments.flatMap((e) => {
    const swimmer = swimmers.get(e.swimmerId)
    if (!swimmer) return []
    const att = attendanceSummary(e, cls.lessons)
    const skills = skillProgress(e, cls.skills)
    return [
      [
        swimmer.name,
        att.rate === null ? '' : Math.round(att.rate * 100),
        ...cls.lessons.map((l) => (e.attendance[l.id] ? ATTENDANCE[e.attendance[l.id]] : '')),
        `${skills.pass}/${skills.total}`,
        ...cls.skills.map((s) => (e.skills[s.id] ? SKILL[e.skills[s.id]] : '')),
        passedLevel(e, cls.skills) ? 'Passed' : 'Not yet',
        nextLevelLabel(cls, e),
        e.comment.trim(),
      ],
    ]
  })
  // The byte-order mark tells Excel the file is UTF-8, so names like "Zoë" come through intact.
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'
}

/** A file name from the class name and session, safe on every OS. */
export function csvFileName(cls: SwimClass): string {
  const base = [cls.name, cls.session].filter(Boolean).join(' - ')
  // Colons aren't allowed in Windows file names; "5:30" becomes "5.30".
  return `${base.replace(/:/g, '.').replace(/[\\/*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'SwimTrack class'}.csv`
}
