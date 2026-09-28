import { describe, expect, it } from 'vitest'
import { client, register, setupApp } from './helpers.ts'

const swimmer = (id: string, name = 'Maya Chen') => ({ id, name, notes: '', createdAt: 1 })
const cls = (id: string) => ({
  id,
  name: 'Swimmer 3 · Tue',
  levelId: 'sw3',
  session: 'Fall 2026',
  schedule: 'Tue 5:30 PM',
  lessons: [{ id: 'l1', topic: 'Kick', date: '2026-09-29', notes: '' }],
  skills: [{ id: 'sw3.front-crawl-15-m', name: 'Front crawl, 15 m', category: 'Movement & Swimming' }],
  enrollments: [{ swimmerId: 's1', attendance: { l1: 'present' }, skills: { 'sw3.front-crawl-15-m': 'pass' }, comment: '', nextLevelId: '' }],
  createdAt: 1,
})

describe('sync', () => {
  it('requires a session', async () => {
    const { app } = setupApp()
    expect((await client(app).post('/api/sync', { cursor: 0, changes: [] })).status).toBe(401)
  })

  it('stores changes and returns everything after the cursor', async () => {
    const { app } = setupApp()
    const laptop = client(app)
    await register(laptop)
    const first = await laptop.post('/api/sync', {
      cursor: 0,
      changes: [
        { kind: 'swimmer', id: 's1', op: 'put', data: swimmer('s1') },
        { kind: 'class', id: 'c1', op: 'put', data: cls('c1') },
      ],
    })
    expect(first.status).toBe(200)
    expect(first.json.docs).toHaveLength(2)
    const cursor = first.json.cursor
    expect(cursor).toBeGreaterThan(0)

    // Nothing new since that cursor.
    expect((await laptop.post('/api/sync', { cursor, changes: [] })).json.docs).toEqual([])

    // A second device signed in to the same account pulls both, then sees a rename and a delete.
    const { PASSWORD } = await import('./helpers.ts')
    const phone = client(app)
    await phone.post('/api/auth/login', { email: 'coach@example.com', password: PASSWORD })
    const pulled = await phone.post('/api/sync', { cursor: 0, changes: [] })
    expect(pulled.json.docs.map((d: { id: string }) => d.id).sort()).toEqual(['c1', 's1'])
    expect(pulled.json.docs.find((d: { id: string }) => d.id === 'c1').data.enrollments[0].skills).toEqual({ 'sw3.front-crawl-15-m': 'pass' })

    await laptop.post('/api/sync', {
      cursor,
      changes: [
        { kind: 'swimmer', id: 's1', op: 'put', data: swimmer('s1', 'Maya C.') },
        { kind: 'class', id: 'c1', op: 'delete' },
      ],
    })
    const delta = await phone.post('/api/sync', { cursor: pulled.json.cursor, changes: [] })
    expect(delta.json.docs).toHaveLength(2)
    expect(delta.json.docs.find((d: { id: string }) => d.id === 's1').data.name).toBe('Maya C.')
    expect(delta.json.docs.find((d: { id: string }) => d.id === 'c1')).toMatchObject({ deleted: true, data: null })
  })

  it('keeps each account’s data private', async () => {
    const { app } = setupApp()
    const a = client(app)
    await register(a, 'a@example.com')
    await a.post('/api/sync', { cursor: 0, changes: [{ kind: 'swimmer', id: 's1', op: 'put', data: swimmer('s1') }] })
    const b = client(app)
    await register(b, 'b@example.com')
    expect((await b.post('/api/sync', { cursor: 0, changes: [] })).json.docs).toEqual([])
    // Writing the same id from another account doesn't touch the first account's copy.
    await b.post('/api/sync', { cursor: 0, changes: [{ kind: 'swimmer', id: 's1', op: 'put', data: swimmer('s1', 'Intruder') }] })
    const aDocs = (await a.post('/api/sync', { cursor: 0, changes: [] })).json.docs
    expect(aDocs[0].data.name).toBe('Maya Chen')
  })

  it('rejects malformed or dangerous documents', async () => {
    const { app } = setupApp()
    const c = client(app)
    await register(c)
    const cases = [
      { kind: 'swimmer', id: 's1', op: 'put', data: { ...swimmer('s2') } }, // id mismatch
      { kind: 'swimmer', id: '../etc', op: 'put', data: swimmer('../etc') },
      { kind: 'class', id: 'c1', op: 'put', data: { ...cls('c1'), lessons: [{ id: 'l1', topic: '', date: 'yesterday', notes: '' }] } },
      { kind: 'class', id: 'c1', op: 'put', data: { ...cls('c1'), enrollments: [{ ...cls('c1').enrollments[0], attendance: { l1: 'maybe' } }] } },
    ]
    for (const change of cases) {
      const res = await c.post('/api/sync', { cursor: 0, changes: [change] })
      expect(res.status, JSON.stringify(change).slice(0, 80)).toBe(400)
    }
    const ok = await c.post('/api/sync', { cursor: 0, changes: [{ kind: 'swimmer', id: 's1', op: 'put', data: swimmer('s1') }] })
    expect(ok.status).toBe(200)
  })

  it('drops swimmer photos (older apps may still send them)', async () => {
    const { app } = setupApp()
    const c = client(app)
    await register(c)
    for (const photo of ['data:image/jpeg;base64,/9j/4AAQ', 'javascript:alert(1)']) {
      const res = await c.post('/api/sync', { cursor: 0, changes: [{ kind: 'swimmer', id: 's1', op: 'put', data: { ...swimmer('s1'), photo } }] })
      expect(res.status).toBe(200)
      expect(res.json.docs.find((d: { id: string }) => d.id === 's1').data.photo).toBeUndefined()
    }
  })

  it('strips unknown fields instead of storing them', async () => {
    const { app } = setupApp()
    const c = client(app)
    await register(c)
    const res = await c.post('/api/sync', { cursor: 0, changes: [{ kind: 'swimmer', id: 's1', op: 'put', data: { ...swimmer('s1'), isAdmin: true } }] })
    expect(res.json.docs[0].data.isAdmin).toBeUndefined()
  })
})
