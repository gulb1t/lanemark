/** Only allow in-app redirects, never an absolute or protocol-relative URL from the query string. */
export function safeNext(next: string | null): string {
  return next && next.startsWith('/app') && !next.startsWith('//') && !next.includes('\\') ? next : '/app'
}
