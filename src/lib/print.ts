import { getLevel, LEVEL_BY_ID } from '../data/curriculum'
import { Device, IS_APP } from '../native/platform'
import type { Enrollment, SwimClass } from '../types'
import { passedLevel } from './stats'

/** Name of the level a swimmer should register in next, per the report card rules. */
export function nextLevelLabel(cls: SwimClass, e: Enrollment): string {
  const level = getLevel(cls.levelId)
  if (level?.ageBased) return 'Registration is based on age'
  if (e.nextLevelId === 'none') return 'Program complete'
  const id = e.nextLevelId || (passedLevel(e, cls.skills) ? level?.next : cls.levelId)
  return (id && LEVEL_BY_ID[id]?.name) || '—'
}

/**
 * Prints the report cards currently mounted by <PrintReports>. In the phone app this opens Android's print screen,
 * which prints to any nearby printer or saves a PDF.
 */
export function printReports() {
  document.body.dataset.printing = 'reports'
  if (IS_APP) {
    requestAnimationFrame(() => {
      void Device.print({ name: 'Lanemark report cards' })
        .catch(() => undefined)
        .finally(() => delete document.body.dataset.printing)
    })
    return
  }
  const done = () => {
    delete document.body.dataset.printing
    window.removeEventListener('afterprint', done)
  }
  window.addEventListener('afterprint', done)
  // Let the portal paint before the print dialog snapshots the page.
  requestAnimationFrame(() => window.print())
}
