/**
 * Word-aware matching instead of cmdk's scattered-letter fuzzy match: every query word must start a word in the
 * item (or appear inside it for longer queries). Exact phrase hits rank first.
 */
export function paletteFilter(value: string, search: string, keywords?: string[]): number {
  const hay = `${value} ${keywords?.join(' ') ?? ''}`.toLowerCase()
  const q = search.trim().toLowerCase()
  if (!q) return 1
  if (hay.includes(q)) return 1
  const words = q.split(/\s+/)
  const hayWords = hay.split(/[^a-z0-9]+/)
  const ok = words.every((w) => hayWords.some((h) => h.startsWith(w)) || (w.length >= 4 && hay.includes(w)))
  return ok ? 0.5 : 0
}
