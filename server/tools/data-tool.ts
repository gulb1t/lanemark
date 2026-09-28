/**
 * For moving the live server to another Fly app (.github/workflows/lanemark-move.yml), run on the server itself:
 *
 *   node server/tools/data-tool.ts export   a consistent copy of the database (and the encryption key) to take away
 *   node server/tools/data-tool.ts count    how many users, documents and pools there are, to compare after a move
 *
 * Prints counts only, never data.
 */
import { copyFileSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { dataFile } from '../lib/dataFile.ts'

const dir = process.env.DATA_DIR ?? 'data'
const db = new DatabaseSync(dataFile(dir))

const counts = () =>
  ['users', 'docs', 'pools', 'pool_members']
    .map((table) => `${table}=${(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n}`)
    .join(' ')

const mode = process.argv[2]
if (mode === 'export') {
  const out = join(dir, 'export.db')
  rmSync(out, { force: true })
  // VACUUM INTO writes a complete, consistent copy even while the server keeps running.
  db.exec(`VACUUM INTO '${out}'`)
  const key = join(dir, 'secret.key')
  if (existsSync(key)) copyFileSync(key, join(dir, 'export.key'))
  console.log(counts())
} else if (mode === 'count') {
  console.log(counts())
} else {
  console.error('Usage: node server/tools/data-tool.ts export|count')
  process.exit(1)
}
