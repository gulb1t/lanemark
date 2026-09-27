import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('index.css', () => {
  // The production minifier keeps whichever of the two comes last. With the -webkit- line last, Chrome gets no
  // blur at all on the live site while dev looks fine, so the prefixed line must always come first.
  it('declares -webkit-backdrop-filter before backdrop-filter', () => {
    const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
    const lines = css.split('\n').map((l) => l.trim())
    lines.forEach((line, i) => {
      if (line.startsWith('-webkit-backdrop-filter:')) expect(lines[i + 1]).toMatch(/^backdrop-filter:/)
      if (line.startsWith('backdrop-filter:')) expect(lines[i + 1] ?? '').not.toMatch(/^-webkit-backdrop-filter:/)
    })
  })
})
