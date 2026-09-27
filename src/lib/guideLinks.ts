import type { GuideTarget } from '../data/guide.ts'
import { isoDate } from './dates.ts'
import type { SwimClass } from '../types.ts'

/**
 * Where a guide topic's "Try it" button goes, in whichever classes are loaded (the demo's, or your own): today's
 * class if there is one, otherwise the first active class with swimmers. Without any classes it goes home, where
 * the first-class setup is.
 */
export function guidePath(target: GuideTarget, classes: SwimClass[], today = isoDate()): string {
  const active = classes.filter((c) => !c.archived)
  const cls = active.find((c) => c.enrollments.length && c.lessons.some((l) => l.date === today)) ?? active.find((c) => c.enrollments.length) ?? active[0]
  const base = cls ? `/app/classes/${cls.id}` : null
  const tab = (t: string) => (base ? `${base}?tab=${t}` : '/app')
  switch (target) {
    case 'dashboard':
      return '/app'
    case 'new-class':
      return '/app?new=class'
    case 'swimmers-tab':
      return base ?? '/app'
    case 'attendance':
    case 'skills':
    case 'lessons':
    case 'reports':
      return tab(target)
    case 'report-card': {
      const first = cls?.enrollments[0]
      return first ? `${base}/reports/${first.swimmerId}` : tab('reports')
    }
    case 'settings':
      return '/app/settings?s=security'
    case 'pool':
      return '/app/pool'
    case 'pool-team':
      return '/app/pool?tab=team'
    case 'swimmers':
      return '/app/swimmers'
  }
}

const TARGETS = new Set<string>([
  'dashboard',
  'new-class',
  'swimmers-tab',
  'attendance',
  'skills',
  'lessons',
  'reports',
  'report-card',
  'settings',
  'pool',
  'pool-team',
  'swimmers',
])
export const isGuideTarget = (s: string | null): s is GuideTarget => Boolean(s && TARGETS.has(s))
