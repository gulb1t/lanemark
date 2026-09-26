/** Local calendar date as yyyy-mm-dd (lesson dates are stored this way). */
export function isoDate(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso: string, days: number): string {
  const d = parseIso(iso)
  d.setDate(d.getDate() + days)
  return isoDate(d)
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }): string {
  if (!iso) return ''
  return parseIso(iso).toLocaleDateString(undefined, opts)
}

export function greeting(d = new Date()): string {
  const h = d.getHours()
  return h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}
