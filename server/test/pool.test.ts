import { describe, expect, it } from 'vitest'
import { client, PASSWORD, register, setupApp } from './helpers.ts'

type Client = ReturnType<typeof client>

const lessons = ['2026-08-11', '2026-08-18', '2026-08-25', '2026-09-01', '2026-09-08', '2026-09-15'].map((date, i) => ({ id: `l${i}`, topic: '', date, notes: '' }))
const skills = [
  { id: 'sw3.a', name: 'Front crawl, 15 m', category: 'Swim' },
  { id: 'sw3.b', name: 'Tread water, 1 min', category: 'Water' },
]
const swimmer = (id: string, name: string) => ({ id, name, notes: 'Nervous in deep water', createdAt: 1 })
const cls = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: `Swimmer 3 · ${id}`,
  levelId: 'sw3',
  session: 'Fall 2026',
  schedule: 'Tue 5:30 PM',
  lessons,
  skills,
  enrollments: [
    { swimmerId: 'w1', attendance: { l0: 'present', l1: 'late' }, skills: { 'sw3.a': 'pass', 'sw3.b': 'pass' }, comment: 'Maya’s flutter kick is strong.', nextLevelId: 'sw4' },
    { swimmerId: 'w2', attendance: { l0: 'absent' }, skills: { 'sw3.a': 'incomplete' }, comment: '', nextLevelId: '' },
  ],
  createdAt: 1,
  ...extra,
})

async function team() {
  const env = setupApp()
  const boss = client(env.app)
  const coach = client(env.app)
  await register(boss, 'boss@example.com', 'Sam Supervisor')
  await register(coach, 'coach@example.com', 'Casey Coach')
  const created = await boss.post('/api/pool', { name: 'Riverside Community Centre' })
  expect(created.status).toBe(201)
  const code: string = created.json.pool.inviteCode
  env.clock.t += 60_000
  const joined = await coach.post('/api/pool/join', { code: `${code.slice(0, 4).toLowerCase()}-${code.slice(4)}` })
  expect(joined.status).toBe(200)
  return { ...env, boss, coach, code }
}

const today = '2026-09-20'
const overview = (c: Client) => c.get(`/api/pool/overview?today=${today}`)

describe('pools', () => {
  it('starts with no pool, and the creator is its supervisor', async () => {
    const { app } = setupApp()
    const c = client(app)
    await register(c)
    expect((await c.get('/api/pool')).json).toEqual({ pool: null })
    const res = await c.post('/api/pool', { name: 'Riverside CC' })
    expect(res.status).toBe(201)
    expect(res.json.pool).toMatchObject({ name: 'Riverside CC', role: 'supervisor', shareLeaderboard: false, memberCount: 1 })
    expect(res.json.pool.inviteCode).toMatch(/^[A-HJKMNP-Z2-9]{8}$/)
    expect((await c.post('/api/pool', { name: 'Second' })).status).toBe(409)
  })

  it('lets instructors join with the code, typed any way, and shows each side only what it should', async () => {
    const { boss, coach } = await team()
    const mine = (await coach.get('/api/pool')).json.pool
    expect(mine).toMatchObject({ role: 'instructor', memberCount: 2, name: 'Riverside Community Centre' })
    expect(mine.inviteCode).toBeUndefined()
    // Instructors see who supervises them, without email addresses.
    expect(mine.members.map((m: { name: string; email?: string }) => [m.name, m.email])).toEqual([
      ['Sam Supervisor', undefined],
      ['Casey Coach', undefined],
    ])
    const theirs = (await boss.get('/api/pool')).json.pool
    expect(theirs.members.map((m: { email: string; role: string }) => [m.email, m.role])).toEqual([
      ['boss@example.com', 'supervisor'],
      ['coach@example.com', 'instructor'],
    ])
  })

  it('rejects wrong codes, and limits guessing', async () => {
    const { app } = setupApp()
    const c = client(app)
    await register(c)
    const res = await c.post('/api/pool/join', { code: 'ABCD-EFGH' })
    expect(res.status).toBe(404)
    for (let i = 0; i < 9; i++) await c.post('/api/pool/join', { code: 'ABCD-EFGH' })
    expect((await c.post('/api/pool/join', { code: 'ABCD-EFGH' })).status).toBe(429)
  })

  it('a new invite code replaces the old one', async () => {
    const { app, boss, code } = await team()
    const fresh = await boss.post('/api/pool/invite-code')
    expect(fresh.json.inviteCode).not.toBe(code)
    const late = client(app)
    await register(late, 'late@example.com')
    expect((await late.post('/api/pool/join', { code })).status).toBe(404)
    expect((await late.post('/api/pool/join', { code: fresh.json.inviteCode })).status).toBe(200)
  })

  it('the overview is counts for every class; swimmers, marks and comments only come with an opened class', async () => {
    const { boss, coach } = await team()
    await coach.post('/api/sync', {
      cursor: 0,
      changes: [
        { kind: 'swimmer', id: 'w1', op: 'put', data: swimmer('w1', 'Maya Chen') },
        { kind: 'swimmer', id: 'w2', op: 'put', data: swimmer('w2', 'Noah Patel') },
        { kind: 'class', id: 'c1', op: 'put', data: cls('c1') },
        { kind: 'class', id: 'old', op: 'put', data: cls('old', { archived: true }) },
        { kind: 'class', id: 'gone', op: 'put', data: cls('gone') },
      ],
    })
    await coach.post('/api/sync', { cursor: 0, changes: [{ kind: 'class', id: 'gone', op: 'delete' }] })

    const res = await overview(boss)
    expect(res.status).toBe(200)
    const casey = res.json.instructors.find((i: { name: string }) => i.name === 'Casey Coach')
    expect(casey.classes).toHaveLength(1)
    expect(casey.classes[0]).toMatchObject({
      id: 'c1',
      name: 'Swimmer 3 · c1',
      swimmers: 2,
      lessons: 6,
      past: 6,
      taught: 2,
      missedAttendance: 4,
      assessed: 0.75,
      passed: 1,
      reportsDone: 1,
    })
    const raw = JSON.stringify(res.json)
    for (const secret of ['Maya', 'Noah', 'flutter', 'Nervous', 'w1', 'w2', 'incomplete', 'present']) expect(raw).not.toContain(secret)
  })

  it('lets supervisors open a member’s class in full, read-only, and nobody else', async () => {
    const { app, boss, coach } = await team()
    await coach.post('/api/sync', {
      cursor: 0,
      changes: [
        { kind: 'swimmer', id: 'w1', op: 'put', data: swimmer('w1', 'Maya Chen') },
        { kind: 'swimmer', id: 'w2', op: 'put', data: swimmer('w2', 'Noah Patel') },
        { kind: 'swimmer', id: 'w9', op: 'put', data: swimmer('w9', 'Not In This Class') },
        { kind: 'class', id: 'c1', op: 'put', data: cls('c1') },
      ],
    })
    const coachId = (await coach.get('/api/me')).json.user.id
    const bossId = (await boss.get('/api/me')).json.user.id
    const res = await boss.get(`/api/pool/members/${coachId}/classes/c1`)
    expect(res.status).toBe(200)
    expect(res.json.instructor.name).toBe('Casey Coach')
    expect(res.json.class.enrollments[0].comment).toBe('Maya’s flutter kick is strong.')
    expect(res.json.swimmers.map((w: { name: string }) => w.name).sort()).toEqual(['Maya Chen', 'Noah Patel'])
    expect((await boss.get(`/api/pool/members/${coachId}/classes/nope`)).status).toBe(404)

    // Instructors can't look at anyone's classes, including a supervisor's.
    expect((await coach.get(`/api/pool/members/${bossId}/classes/c1`)).status).toBe(403)
    // A supervisor of another pool can't either.
    const outsider = client(app)
    await register(outsider, 'outsider@example.com')
    await outsider.post('/api/pool', { name: 'Elsewhere' })
    expect((await outsider.get(`/api/pool/members/${coachId}/classes/c1`)).status).toBe(404)
    // Once someone leaves, their classes are closed to the pool.
    await coach.post('/api/pool/leave')
    expect((await boss.get(`/api/pool/members/${coachId}/classes/c1`)).status).toBe(404)
  })

  it('shows instructors the leaderboard only when the supervisor shares it, with no class details', async () => {
    const { boss, coach } = await team()
    await coach.post('/api/sync', { cursor: 0, changes: [{ kind: 'class', id: 'c1', op: 'put', data: cls('c1') }] })
    expect((await overview(coach)).status).toBe(403)
    expect((await coach.patch('/api/pool', { shareLeaderboard: true })).status).toBe(403)
    expect((await boss.patch('/api/pool', { shareLeaderboard: true })).json.pool.shareLeaderboard).toBe(true)
    const res = await overview(coach)
    expect(res.status).toBe(200)
    expect(res.json.instructors).toBeUndefined()
    expect(res.json.leaderboard).toEqual([
      { id: expect.any(String), name: 'Sam Supervisor', you: false, classes: 0, caughtUp: null },
      { id: expect.any(String), name: 'Casey Coach', you: true, classes: 1, caughtUp: expect.any(Number) },
    ])
    expect(JSON.stringify(res.json)).not.toContain('Swimmer 3')
  })

  it('keeps management to supervisors', async () => {
    const { boss, coach } = await team()
    const bossId = (await boss.get('/api/me')).json.user.id
    expect((await coach.post('/api/pool/invite-code')).status).toBe(403)
    expect((await coach.del(`/api/pool/members/${bossId}`)).status).toBe(403)
    expect((await coach.patch(`/api/pool/members/${bossId}`, { role: 'instructor' })).status).toBe(403)
    expect((await coach.del('/api/pool')).status).toBe(403)
  })

  it('always keeps a supervisor', async () => {
    const { boss, coach } = await team()
    const bossId = (await boss.get('/api/me')).json.user.id
    const coachId = (await coach.get('/api/me')).json.user.id
    expect((await boss.patch(`/api/pool/members/${bossId}`, { role: 'instructor' })).status).toBe(409)
    expect((await boss.post('/api/pool/leave')).status).toBe(409)
    // Hand over, then step down and leave.
    expect((await boss.patch(`/api/pool/members/${coachId}`, { role: 'supervisor' })).status).toBe(200)
    const stepped = await boss.patch(`/api/pool/members/${bossId}`, { role: 'instructor' })
    expect(stepped.json.pool.role).toBe('instructor')
    expect(stepped.json.pool.inviteCode).toBeUndefined()
    expect((await boss.post('/api/pool/leave')).json).toEqual({ ok: true, closed: false })
    expect((await coach.get('/api/pool')).json.pool.memberCount).toBe(1)
    // The last member leaving removes the pool.
    expect((await coach.post('/api/pool/leave')).json).toEqual({ ok: true, closed: true })
  })

  it('removing someone takes them out of the overview but leaves their classes alone', async () => {
    const { boss, coach } = await team()
    await coach.post('/api/sync', { cursor: 0, changes: [{ kind: 'class', id: 'c1', op: 'put', data: cls('c1') }] })
    const coachId = (await coach.get('/api/me')).json.user.id
    expect((await boss.del(`/api/pool/members/${coachId}`)).json.pool.memberCount).toBe(1)
    expect((await coach.get('/api/pool')).json.pool).toBeNull()
    expect((await overview(boss)).json.instructors).toHaveLength(1)
    expect((await coach.post('/api/sync', { cursor: 0, changes: [] })).json.docs).toHaveLength(1)
  })

  it('closing the pool, or deleting the only supervisor’s account, frees everyone', async () => {
    const first = await team()
    expect((await first.boss.del('/api/pool')).status).toBe(200)
    expect((await first.coach.get('/api/pool')).json.pool).toBeNull()

    const second = await team()
    expect((await second.boss.del('/api/account', { password: PASSWORD })).status).toBe(200)
    expect((await second.coach.get('/api/pool')).json.pool).toBeNull()
    expect((await second.coach.post('/api/pool/join', { code: second.code })).status).toBe(404)
  })

  it('one pool at a time', async () => {
    const { app, coach } = await team()
    const other = client(app)
    await register(other, 'other@example.com')
    const code = (await other.post('/api/pool', { name: 'Other pool' })).json.pool.inviteCode
    expect((await coach.post('/api/pool/join', { code })).status).toBe(409)
  })

  it('needs a session', async () => {
    const { app } = setupApp()
    expect((await client(app).get('/api/pool')).status).toBe(401)
    expect((await client(app).get('/api/pool/overview')).status).toBe(401)
  })
})
