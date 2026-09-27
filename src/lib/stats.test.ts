import { describe, expect, it } from 'vitest'
import { scheduleNote } from './stats'

describe('scheduleNote', () => {
  it('drops the parts of the schedule the class name already says', () => {
    expect(scheduleNote({ name: 'Swimmer 3 · Tue 5:30 PM', schedule: 'Tue 5:30 PM' })).toBe('')
    expect(scheduleNote({ name: 'Swimmer 3 · Sat 5:30 PM', schedule: 'Sat 5:30 PM · Lane 2' })).toBe('Lane 2')
    expect(scheduleNote({ name: 'Swimmer 3', schedule: 'Tue 5:30 PM' })).toBe('Tue 5:30 PM')
    expect(scheduleNote({ name: 'Sharks', schedule: '' })).toBe('')
  })
})
