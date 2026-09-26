import { formatDate } from './dates.ts'
import { isReportDone } from './reportRules.ts'
import { skillProgress } from './stats.ts'
import type { SwimClass } from '../types.ts'

export type ActionKind = 'attendance' | 'reports' | 'skills' | 'dates'

export interface NextAction {
  id: string
  kind: ActionKind
  classId: string
  className: string
  title: string
  detail: string
  to: string
}

/**
 * What an instructor should do next, most urgent first: attendance that was never taken, report cards due near
 * the end of a session, skills still to assess, and classes with no lesson dates.
 */
export function nextActions(classes: SwimClass[], today: string): NextAction[] {
  const out: NextAction[] = []
  for (const c of classes) {
    if (c.archived || !c.enrollments.length) continue
    const base = `/app/classes/${c.id}`

    c.lessons.forEach((l, i) => {
      if (!l.date || l.date >= today) return
      const missing = c.enrollments.filter((e) => !e.attendance[l.id]).length
      if (missing === c.enrollments.length) {
        out.push({
          id: `att:${c.id}:${l.id}`,
          kind: 'attendance',
          classId: c.id,
          className: c.name,
          title: `Take attendance for lesson ${i + 1}`,
          detail: formatDate(l.date),
          to: `${base}?tab=attendance&lesson=${l.id}`,
        })
      }
    })

    const taught = c.lessons.filter((l) => c.enrollments.some((e) => e.attendance[l.id])).length
    const notDone = c.enrollments.filter((e) => !isReportDone(e, c.skills))
    if (c.lessons.length && taught / c.lessons.length >= 0.6 && notDone.length) {
      out.push({
        id: `rep:${c.id}`,
        kind: 'reports',
        classId: c.id,
        className: c.name,
        title: `Finish ${notDone.length} report card${notDone.length === 1 ? '' : 's'}`,
        detail: `${c.enrollments.length - notDone.length} of ${c.enrollments.length} done`,
        to: `${base}/reports/${notDone[0].swimmerId}`,
      })
    }

    const unassessed = c.enrollments.reduce((n, e) => n + skillProgress(e, c.skills).unmarked, 0)
    if (taught > 0 && unassessed) {
      out.push({
        id: `skl:${c.id}`,
        kind: 'skills',
        classId: c.id,
        className: c.name,
        title: `Assess ${unassessed} skill${unassessed === 1 ? '' : 's'}`,
        detail: `across ${c.enrollments.length} swimmer${c.enrollments.length === 1 ? '' : 's'}`,
        to: `${base}?tab=skills`,
      })
    }

    if (c.lessons.length && c.lessons.every((l) => !l.date)) {
      out.push({ id: `dat:${c.id}`, kind: 'dates', classId: c.id, className: c.name, title: 'Add lesson dates', detail: 'so today’s class shows up here', to: `${base}?tab=lessons` })
    }
  }
  const rank: Record<ActionKind, number> = { attendance: 0, reports: 1, skills: 2, dates: 3 }
  return out.sort((a, b) => rank[a.kind] - rank[b.kind])
}
