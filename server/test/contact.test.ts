import { describe, expect, it } from 'vitest'
import { client, setupApp } from './helpers.ts'

const tick = () => new Promise((r) => setTimeout(r, 5))
const REQUEST = { name: 'Dana Ruiz', email: 'dana@example.com', organisation: 'Riverside Aquatics', plan: 'city', pools: 6, message: 'Could we try this with <b>two</b> pools?' }

describe('pilot requests', () => {
  it('emails the team with the details, escaped, and replies go to the requester', async () => {
    const { app, mailer } = setupApp(undefined, { contactEmail: 'team@swimtrack.test' })
    const res = await client(app).post('/api/contact', REQUEST)
    expect(res.status).toBe(200)
    await tick()
    const mail = mailer.list()[0]
    expect(mail).toMatchObject({ to: 'team@swimtrack.test', replyTo: 'dana@example.com', subject: 'Pilot request (City): Riverside Aquatics' })
    expect(mail.text).toContain('Pools: 6')
    expect(mail.html).toContain('&lt;b&gt;two&lt;/b&gt;')
    expect(mail.html).not.toContain('<b>two</b>')
  })

  it('never emails the address in the form', async () => {
    const { app, mailer } = setupApp(undefined, { contactEmail: 'team@swimtrack.test' })
    await client(app).post('/api/contact', REQUEST)
    await tick()
    expect(mailer.list().every((m) => m.to === 'team@swimtrack.test')).toBe(true)
  })

  it('rejects header tricks and bad input', async () => {
    const { app } = setupApp(undefined, { contactEmail: 'team@swimtrack.test' })
    const c = client(app)
    expect((await c.post('/api/contact', { ...REQUEST, name: 'Dana\r\nBcc: x@evil.test' })).status).toBe(400)
    expect((await c.post('/api/contact', { ...REQUEST, plan: 'free' })).status).toBe(400)
    expect((await c.post('/api/contact', { ...REQUEST, email: 'nope' })).status).toBe(400)
  })

  it('quietly drops bot submissions and rate limits by address', async () => {
    const { app, mailer } = setupApp(undefined, { contactEmail: 'team@swimtrack.test' })
    const c = client(app)
    expect((await c.post('/api/contact', { ...REQUEST, website: 'http://spam.test' })).status).toBe(200)
    await tick()
    expect(mailer.list()).toHaveLength(0)
    for (let i = 0; i < 4; i++) expect((await c.post('/api/contact', REQUEST)).status).toBe(200)
    expect((await c.post('/api/contact', REQUEST)).status).toBe(429)
  })

  it('is off when no inbox is configured', async () => {
    const { app } = setupApp(undefined, { contactEmail: undefined })
    const c = client(app)
    expect((await c.get('/api/contact')).json).toEqual({ enabled: false })
    expect((await c.post('/api/contact', REQUEST)).status).toBe(404)
  })
})

describe('client addresses behind a proxy', () => {
  it('uses the address the proxy appended, so a made-up X-Forwarded-For cannot dodge rate limits', async () => {
    const { app } = setupApp(undefined, { contactEmail: 'team@swimtrack.test', trustProxy: true })
    const c = client(app)
    // Same real client (last entry), a different fake first entry each time.
    for (let i = 0; i < 5; i++) expect((await c.post('/api/contact', REQUEST, { 'x-forwarded-for': `10.0.0.${i}, 203.0.113.7` })).status).toBe(200)
    expect((await c.post('/api/contact', REQUEST, { 'x-forwarded-for': '10.9.9.9, 203.0.113.7' })).status).toBe(429)
    // A different real client still gets through.
    expect((await c.post('/api/contact', REQUEST, { 'x-forwarded-for': '203.0.113.8' })).status).toBe(200)
  })
})

describe('allowed origins', () => {
  it('lets wildcard origins cover subdomains, and nothing else', async () => {
    const { app } = setupApp(undefined, { contactEmail: 'team@swimtrack.test', origins: ['https://*.trycloudflare.com'] })
    const post = (origin: string) => client(app).post('/api/contact', REQUEST, { origin })
    expect((await post('https://cannon-seats.trycloudflare.com')).status).toBe(200)
    expect((await post('http://cannon-seats.trycloudflare.com')).status).toBe(403)
    expect((await post('https://trycloudflare.com.evil.test')).status).toBe(403)
    expect((await post('https://evil-trycloudflare.com')).status).toBe(403)
  })
})
