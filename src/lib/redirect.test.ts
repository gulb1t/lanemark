import { describe, expect, it } from 'vitest'
import { safeNext } from './redirect'

describe('safeNext', () => {
  it('keeps in-app paths', () => {
    expect(safeNext('/app/classes/abc?tab=skills')).toBe('/app/classes/abc?tab=skills')
  })
  it('blocks open redirects', () => {
    for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '/login', null, '']) {
      expect(safeNext(bad)).toBe('/app')
    }
  })
})
