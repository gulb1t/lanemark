import { describe, expect, it } from 'vitest'
import { setupApp } from './helpers.ts'

describe('a server that has moved', () => {
  const { app } = setupApp(undefined, { movedTo: 'https://lanemark.fly.dev' })

  it('sends pages to the new address, keeping the path', async () => {
    const res = await app.request('http://localhost/app/classes/abc?tab=skills')
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('https://lanemark.fly.dev/app/classes/abc?tab=skills')
  })

  it('tells the app where it went instead of answering', async () => {
    const res = await app.request('http://localhost/api/me')
    expect(res.status).toBe(410)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('moved')
  })

  it('keeps its health check up for Fly', async () => {
    expect((await app.request('http://localhost/api/health')).status).toBe(200)
  })
})
