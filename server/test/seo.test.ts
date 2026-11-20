import { describe, expect, it } from 'vitest'
import { pageMeta, renderShell, robotsTxt, sitemapXml } from '../../src/lib/seo.ts'

const SHELL = `<!doctype html><html><head>
    <meta name="description" content="old" />
    <meta property="og:title" content="old" />
    <title>Lanemark</title>
  </head><body></body></html>`
const ORIGIN = 'https://lanemark.example'

describe('search engine tags', () => {
  it('gives each public page its own title, description and canonical address', () => {
    const { html, index } = renderShell(SHELL, '/help/', ORIGIN)
    expect(index).toBe(true)
    expect(html).toContain(`<title>${pageMeta('/help').title}</title>`)
    expect(html).toContain('<link rel="canonical" href="https://lanemark.example/help" />')
    expect(html).toContain('<meta property="og:image" content="https://lanemark.example/og.png" />')
    expect(html).not.toContain('content="old"')
    expect(html.match(/name="description"/g)).toHaveLength(1)
  })

  it('keeps sign-in-only screens and unknown paths out of search results', () => {
    for (const path of ['/app', '/app/classes/abc', '/reset-password', '/nope']) {
      const { html, index } = renderShell(SHELL, path, ORIGIN)
      expect(index, path).toBe(false)
      expect(html, path).toContain('<meta name="robots" content="noindex" />')
      expect(html, path).not.toContain('rel="canonical"')
    }
  })

  it('escapes anything that lands in an attribute', () => {
    const { html } = renderShell(SHELL, '/"><script>', ORIGIN)
    expect(html).not.toContain('"><script>')
  })

  it('lists the public pages in the sitemap and points robots.txt at it', () => {
    expect(sitemapXml(ORIGIN)).toContain('<loc>https://lanemark.example/privacy</loc>')
    expect(sitemapXml(ORIGIN)).not.toContain('/app')
    expect(robotsTxt(ORIGIN)).toContain('Sitemap: https://lanemark.example/sitemap.xml')
    expect(robotsTxt(ORIGIN)).toContain('Disallow: /app')
  })
})
