/** Writes docs/GUIDE.md from src/data/guide.ts (the Help page's content). Run with `npm run guide:md`. */
import { readFileSync, writeFileSync } from 'node:fs'
import { GUIDE } from '../src/data/guide.ts'
import { renderGuideMarkdown } from '../src/lib/guideMarkdown.ts'

const shots = JSON.parse(readFileSync('src/data/guideShots.json', 'utf8'))
writeFileSync('docs/GUIDE.md', renderGuideMarkdown(GUIDE, shots))
console.log('Wrote docs/GUIDE.md')
