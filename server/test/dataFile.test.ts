import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { applyImport, dataFile } from '../lib/dataFile.ts'

describe('the data file after the rename', () => {
  const dirs: string[] = []
  const fresh = () => {
    const dir = mkdtempSync(join(tmpdir(), 'lanemark-data-'))
    dirs.push(dir)
    return dir
  }
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
  })

  it('renames swimtrack.db (and its log) to lanemark.db once', () => {
    const dir = fresh()
    writeFileSync(join(dir, 'swimtrack.db'), 'data')
    writeFileSync(join(dir, 'swimtrack.db-wal'), 'log')
    expect(dataFile(dir)).toBe(join(dir, 'lanemark.db'))
    expect(readFileSync(join(dir, 'lanemark.db'), 'utf8')).toBe('data')
    expect(readFileSync(join(dir, 'lanemark.db-wal'), 'utf8')).toBe('log')
    expect(existsSync(join(dir, 'swimtrack.db'))).toBe(false)
  })

  it('leaves an existing lanemark.db alone', () => {
    const dir = fresh()
    writeFileSync(join(dir, 'lanemark.db'), 'new')
    writeFileSync(join(dir, 'swimtrack.db'), 'old')
    dataFile(dir)
    expect(readFileSync(join(dir, 'lanemark.db'), 'utf8')).toBe('new')
    expect(existsSync(join(dir, 'swimtrack.db'))).toBe(true)
  })

  it('takes over an imported database and key, keeping the old ones beside them', () => {
    const dir = fresh()
    writeFileSync(join(dir, 'lanemark.db'), 'empty')
    writeFileSync(join(dir, 'secret.key'), 'new-key')
    writeFileSync(join(dir, 'lanemark-import.db'), 'moved')
    writeFileSync(join(dir, 'secret-import.key'), 'old-key')
    applyImport(dir)
    expect(readFileSync(join(dir, 'lanemark.db'), 'utf8')).toBe('moved')
    expect(readFileSync(join(dir, 'secret.key'), 'utf8')).toBe('old-key')
    expect(readFileSync(join(dir, 'lanemark.db.before-import'), 'utf8')).toBe('empty')
    expect(existsSync(join(dir, 'lanemark-import.db'))).toBe(false)
    // Runs on every start: with nothing to import it changes nothing.
    applyImport(dir)
    expect(readFileSync(join(dir, 'lanemark.db'), 'utf8')).toBe('moved')
  })
})
