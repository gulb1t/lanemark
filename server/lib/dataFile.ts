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

