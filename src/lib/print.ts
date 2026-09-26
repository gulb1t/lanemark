import { getLevel, LEVEL_BY_ID } from '../data/curriculum'
import type { Enrollment, SwimClass } from '../types'
import { passedLevel } from './stats'

/** Name of the level a swimmer should register in next, per the manual's rules. */
export function nextLevelLabel(cls: SwimClass, e: Enrollment): string {
  const level = getLevel(cls.levelId)
  if (level?.ageBased) return 'Registration is based on age'
  if (e.nextLevelId === 'none') return 'Program complete'
  const id = e.nextLevelId || (passedLevel(e, cls.skills) ? level?.next : cls.levelId)
  return (id && LEVEL_BY_ID[id]?.name) || '—'
}

/** Prints the report cards currently mounted by <PrintReports>. */
export function printReports() {
  document.body.dataset.printing = 'reports'
  const done = () => {
    delete document.body.dataset.printing
    window.removeEventListener('afterprint', done)
  }
  window.addEventListener('afterprint', done)
  // Let the portal paint before the print dialog snapshots the page.
  requestAnimationFrame(() => window.print())
}
