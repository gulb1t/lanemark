import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { client, PASSWORD, register, setupApp } from '../../server/test/helpers'
import { useStore } from '../store/useStore'
import { startSync, stopSync, syncNow, useSync } from './engine'

/**
 * Drives the real sync engine against the real API (in-process). fetch is routed into the Hono app with a cookie
 * jar, and can be switched "offline".
 */

beforeAll(() => {
  const target = new EventTarget()
  Object.assign(globalThis, {
    window: target,
    document: Object.assign(new EventTarget(), { visibilityState: 'visible' }),
  })
})

afterEach(() => stopSync())

async function device() {
  const env = setupApp()
  const other = client(env.app)
  const user = await register(other)
  const jar = new Map<string, string>()
  const state = { online: true }
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!state.online) throw new TypeError('Failed to fetch')
    const headers = new Headers(init?.headers)
    headers.set('origin', 'http://localhost:5173')
    if (jar.size) headers.set('cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; '))
    const res = await env.app.request(`http://localhost${String(input)}`, { ...init, headers })
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(';')
      const [k, v] = pair.split('=')
      if (v) jar.set(k, v)
    }
    return res
  }) as typeof fetch
  // Sign this "browser" in.
  const login = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'coach@example.com', password: PASSWORD }),
  })
  expect(login.status).toBe(200)
  return { ...env, other, user, state }
}

const pull = async (c: ReturnType<typeof client>) => (await c.post('/api/sync', { cursor: 0, changes: [] })).json.docs as { id: string; deleted: boolean; data: any }[]

describe('sync engine', () => {
  it('pushes local edits to the server', async () => {
    const { other, user } = await device()
    await startSync({ userId: user.id, remote: true })
    const classId = useStore.getState().addClass({ levelId: 'sw2', session: 'Fall', schedule: 'Mon', lessonCount: 6 })
    useStore.getState().addSwimmer({ name: 'Maya Chen' }, classId)
    await syncNow()
    expect(useSync.getState()).toMatchObject({ status: 'synced', pending: 0 })
    const docs = await pull(other)
    expect(docs.map((d) => d.id)).toContain(classId)
    expect(docs.find((d) => d.id === classId)!.data.enrollments).toHaveLength(1)
  })

  it('queues edits while offline and flushes them when back online', async () => {
    const { other, user, state } = await device()
    await startSync({ userId: user.id, remote: true })
    state.online = false
    const id = useStore.getState().addSwimmer({ name: 'Offline Otto' })
    useStore.getState().updateSwimmer(id, { notes: 'added poolside' })
    await syncNow()
    expect(useSync.getState().status).toBe('offline')
    expect(useSync.getState().pending).toBe(1)
    expect((await pull(other)).some((d) => d.id === id)).toBe(false)

    state.online = true
    await syncNow()
    expect(useSync.getState()).toMatchObject({ status: 'synced', pending: 0 })
    expect((await pull(other)).find((d) => d.id === id)!.data.notes).toBe('added poolside')
  })

  it('pulls changes and deletions made on another device', async () => {
    const { other, user } = await device()
    await startSync({ userId: user.id, remote: true })
    await other.post('/api/sync', {
      cursor: 0,
      changes: [{ kind: 'swimmer', id: 'remote-1', op: 'put', data: { id: 'remote-1', name: 'From Phone', notes: '', createdAt: 1 } }],
    })
    await syncNow()
    expect(useStore.getState().swimmers.map((w) => w.name)).toContain('From Phone')
    await other.post('/api/sync', { cursor: 0, changes: [{ kind: 'swimmer', id: 'remote-1', op: 'delete' }] })
    await syncNow()
    expect(useStore.getState().swimmers.some((w) => w.id === 'remote-1')).toBe(false)
    // Applying remote changes must not echo them back as local edits.
    expect(useSync.getState().pending).toBe(0)
  })

  it('never overwrites an edit made while a sync is in flight', async () => {
    const { user } = await device()
    await startSync({ userId: user.id, remote: true })
    const id = useStore.getState().addSwimmer({ name: 'First' })
    const flushing = syncNow()
    useStore.getState().updateSwimmer(id, { name: 'Second' })
    await flushing
    await syncNow()
    expect(useStore.getState().swimmers.find((w) => w.id === id)!.name).toBe('Second')
    expect(useSync.getState().pending).toBe(0)
  })

  it('stays local-only for the demo', async () => {
    await startSync({ userId: 'demo', remote: false })
    let called = false
    globalThis.fetch = (async () => {
      called = true
      throw new Error('should not be called')
    }) as typeof fetch
    useStore.getState().addSwimmer({ name: 'Demo kid' })
    await syncNow()
    expect(called).toBe(false)
    expect(useSync.getState().status).toBe('local')
  })
})
