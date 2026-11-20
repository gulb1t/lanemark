/**
 * What search engines and link previews see. The server writes these into index.html for each public page (so
 * crawlers get the right title without running any script), lists them in sitemap.xml, and marks every other path
 * noindex: those are sign-in-only screens or links that only make sense from an email.
 */

export interface PageMeta {
  title: string
  description: string
}

export const PUBLIC_PAGES: Record<string, PageMeta> = {
  '/': {
    title: 'Lanemark: swim lesson attendance, skills and report cards',
    description:
      'Take attendance, check off Swim for Life skills and write report cards in minutes. Built for swim instructors, works offline on the pool deck, in the browser or on Android.',
  },
  '/help': {
    title: 'How to use Lanemark: guides for swim instructors',
    description:
      'Step-by-step guides with pictures: making a class, adding swimmers, taking attendance, marking skills, writing and printing report cards, and running a pool.',
  },
  '/privacy': {
    title: 'Privacy: how Lanemark handles swimmer data',
    description:
      'What Lanemark stores about instructors and swimmers, where it lives, who can see it, and how to export or delete it. No ads, analytics or tracking.',
  },
  '/signup': {
    title: 'Create a Lanemark account',
    description: 'Make an account to track attendance, skills and report cards for your swim classes.',
  },
  '/login': {
    title: 'Sign in to Lanemark',
    description: 'Sign in to your Lanemark account to see your swim classes.',
  },
}

const FALLBACK: PageMeta = { title: 'Lanemark', description: PUBLIC_PAGES['/'].description }

/** The page's meta, and whether search engines should index it. Trailing slashes don't make a new page. */
export function pageMeta(path: string): PageMeta & { index: boolean } {
  const clean = path.length > 1 ? path.replace(/\/+$/, '') : path
  const page = PUBLIC_PAGES[clean]
  return page ? { ...page, index: true } : { ...FALLBACK, index: false }
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** index.html with this page's title, description, canonical address and preview tags filled in. */
export function renderShell(html: string, path: string, origin: string): { html: string; index: boolean } {
  const meta = pageMeta(path)
  const url = origin + (meta.index ? (path.length > 1 ? path.replace(/\/+$/, '') : '/') : path)
  const tags = [
    `<meta name="description" content="${escape(meta.description)}" />`,
    meta.index ? `<link rel="canonical" href="${escape(url)}" />` : '<meta name="robots" content="noindex" />',
    `<meta property="og:title" content="${escape(meta.title)}" />`,
    `<meta property="og:description" content="${escape(meta.description)}" />`,
    `<meta property="og:url" content="${escape(url)}" />`,
    `<meta property="og:image" content="${escape(origin)}/og.png" />`,
    `<meta name="twitter:image" content="${escape(origin)}/og.png" />`,
  ].join('\n    ')
  const out = html
    .replace(/<title>[^<]*<\/title>/, `<title>${escape(meta.title)}</title>`)
    .replace(/\s*<meta name="description"[^>]*>/, '')
    .replace(/\s*<meta property="og:(title|description)"[^>]*>/g, '')
    .replace('</head>', `  ${tags}\n  </head>`)
  return { html: out, index: meta.index }
}

export function robotsTxt(origin: string): string {
  return `User-agent: *\nDisallow: /app\nDisallow: /api/\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`
}

export function sitemapXml(origin: string): string {
  const urls = Object.keys(PUBLIC_PAGES)
    .map((p) => `  <url><loc>${escape(origin + p)}</loc></url>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}
