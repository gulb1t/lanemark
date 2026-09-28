import { existsSync, renameSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The SQLite file in the data folder. It was `swimtrack.db` before the app was renamed Lanemark: on the first start
 * after the rename, an old file (with its write-ahead log) is renamed in place, so no data is left behind.
 */
export function dataFile(dir: string): string {
  const now = join(dir, 'lanemark.db')
  const old = join(dir, 'swimtrack.db')
  if (!existsSync(now) && existsSync(old)) {
    for (const ext of ['', '-wal', '-shm']) if (existsSync(old + ext)) renameSync(old + ext, now + ext)
  }
  return now
}

/**
 * Moving the server: files put in the data folder as `lanemark-import.db` and `secret-import.key` replace the database
 * and the encryption key on the next start. What was there before is kept beside it as `*.before-import`.
 */
export function applyImport(dir: string) {
  const incoming = join(dir, 'lanemark-import.db')
  if (existsSync(incoming)) {
    const now = join(dir, 'lanemark.db')
    for (const ext of ['', '-wal', '-shm']) if (existsSync(now + ext)) renameSync(now + ext, `${now}.before-import${ext}`)
    renameSync(incoming, now)
  }
  const key = join(dir, 'secret-import.key')
  if (existsSync(key)) {
    const now = join(dir, 'secret.key')
    if (existsSync(now)) renameSync(now, `${now}.before-import`)
    renameSync(key, now)
  }
}
