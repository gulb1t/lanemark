import { describe, expect, it } from 'vitest'
import { paletteFilter } from './paletteFilter'

describe('paletteFilter', () => {
  it('matches names and word prefixes', () => {
    expect(paletteFilter('swimmer Maya Chen', 'maya')).toBe(1)
    expect(paletteFilter('swimmer Maya Chen', 'ma ch')).toBe(0.5)
    expect(paletteFilter('skill Front crawl, 50 m Swimmer 5', 'front crawl 50')).toBe(0.5)
  })
  it('does not match scattered letters', () => {
    expect(paletteFilter('skill Water Smart: Swim with a Buddy; Wear a Lifejacket', 'maya')).toBe(0)
    expect(paletteFilter('swimmer Lucas Tremblay Second session in this level.', 'maya')).toBe(0)
  })
  it('uses keywords', () => {
    expect(paletteFilter('Settings', '2fa', ['account', '2fa'])).toBe(1)
  })
})
