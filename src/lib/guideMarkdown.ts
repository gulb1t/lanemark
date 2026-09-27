import type { GuideSection } from '../data/guide.ts'

/** The live demo, for "Try it" links in the Markdown guide. */
export const LIVE_URL = 'https://swimtrack.fly.dev'

type Shots = Record<string, { width: number; height: number }>

/** A screenshot that follows GitHub's light or dark theme. Paths are relative to docs/. */
function picture(name: string, alt: string, shots: Shots): string {
  const size = shots[name]
  if (!size) return ''
  const width = Math.min(size.width, 720)
  return [
    '<picture>',
    `  <source media="(prefers-color-scheme: dark)" srcset="../public/guide/${name}-dark.webp">`,
    `  <img src="../public/guide/${name}-light.webp" alt="${alt}" width="${width}">`,
    '</picture>',
  ].join('\n')
}

/** docs/GUIDE.md, from the same content as the Help page. */
export function renderGuideMarkdown(guide: GuideSection[], shots: Shots): string {
  const out: string[] = [
    '# How to use SwimTrack',
    '',
    '<!-- Generated from src/data/guide.ts by `npm run guide:md`. Edit that file, not this one. -->',
    '',
    `The same guide is in the app under **Help** (\`/help\`), where every “Try it” opens the real screen. You can also [try the demo](${LIVE_URL}/demo).`,
    '',
    '## Contents',
    '',
  ]
  for (const s of guide) out.push(`- **${s.title}:** ${s.topics.map((t) => `[${t.title}](#${t.id})`).join(' · ')}`)
  for (const s of guide) {
    out.push('', `## ${s.title}`, '', s.intro)
    for (const t of s.topics) {
      out.push('', `<a id="${t.id}"></a>`, '', `### ${t.title}`, '', `_${t.summary}_`, '')
      t.steps.forEach((step, i) => out.push(`${i + 1}. ${step}`))
      if (t.tips?.length) {
        out.push('')
        for (const tip of t.tips) out.push(`> 💡 ${tip}`, '>')
        out.pop()
      }
      if (t.shot && shots[t.shot]) out.push('', picture(t.shot, t.title, shots))
      if (t.tryIt) out.push('', `[Try it in the demo →](${LIVE_URL}/demo?go=${t.tryIt})`)
    }
  }
  return out.join('\n') + '\n'
}
