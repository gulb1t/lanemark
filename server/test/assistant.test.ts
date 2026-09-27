import { describe, expect, it } from 'vitest'
import { askAssistant, safePath } from '../assistant.ts'
import { openSqlite } from '../db/sqlite.ts'
import { client, setupApp } from './helpers.ts'

const ctx = {
  path: '/app',
  today: '2026-09-26',
  classes: [{ id: 'c1', name: 'Swimmer 3', levelId: 'sw3', lessons: 8, taught: 5, swimmers: 6, reportsDone: 0, unassessed: 12, todayLesson: 6, nextLessonDate: null }],
}
const ai = { key: 'test-key', model: 'test-model', baseUrl: 'http://ai.test/v1' }

/** A fake chat API that plays back scripted assistant messages and records what it was sent. */
function fakeAi(script: object[]) {
  const sent: any[] = []
  const impl = (async (_url: string, init: RequestInit) => {
    sent.push(JSON.parse(String(init.body)))
    const message = script[Math.min(sent.length - 1, script.length - 1)]
    return new Response(JSON.stringify({ choices: [{ message }] }), { status: 200 })
  }) as unknown as typeof fetch
  return { impl, sent }
}
const call = (name: string, args: object, id = name) => ({ id, type: 'function', function: { name, arguments: JSON.stringify(args) } })

describe('assistant', () => {
  it('only allows in-app pages and the user’s own classes', () => {
    expect(safePath('/app/curriculum?level=sw4', ctx)).toBe(true)
    expect(safePath('/app/classes/c1?tab=attendance', ctx)).toBe(true)
    expect(safePath('/app/pool?tab=rankings', ctx)).toBe(true)
    expect(safePath('/app/classes/someone-else', ctx)).toBe(false)
    expect(safePath('https://evil.example', ctx)).toBe(false)
    expect(safePath('//evil.example/app', ctx)).toBe(false)
    expect(safePath('/app/../admin', ctx)).toBe(false)
  })

  it('runs curriculum lookups on the server and turns navigate calls into buttons', async () => {
    const { impl, sent } = fakeAi([
      { content: null, tool_calls: [call('get_level', { levelId: 'sw3' }), call('navigate', { path: '/app/classes/c1?tab=skills', label: 'Check skills' }), call('navigate', { path: 'https://evil.example', label: 'Bad' }, 'bad')] },
      { content: 'Front crawl in Swimmer 3 is 15 m.' },
    ])
    const res = await askAssistant(ai, [{ role: 'user', content: 'front crawl distance in swimmer 3?' }], ctx, impl)
    expect(res.reply).toBe('Front crawl in Swimmer 3 is 15 m.')
    expect(res.actions).toEqual([{ kind: 'navigate', label: 'Check skills', target: '/app/classes/c1?tab=skills' }])
    const toolReplies = sent[1].messages.filter((m: any) => m.role === 'tool')
    expect(toolReplies[0].content).toContain('Front crawl, 15 m')
    expect(toolReplies[2].content).toMatch(/Rejected/)
    // The system prompt carries class summaries but the request never includes swimmer names.
    expect(sent[0].messages[0].content).toContain('Swimmer 3')
    expect(sent[0].model).toBe('test-model')
  })

  it('is off without a key, and rate-limited when on', async () => {
    const off = setupApp()
    expect((await client(off.app).get('/api/assistant')).json).toEqual({ enabled: false })
    expect((await client(off.app).post('/api/assistant', { messages: [{ role: 'user', content: 'hi' }], context: ctx })).status).toBe(404)

    const { impl } = fakeAi([{ content: 'Hi! How can I help?' }])
    const on = setupApp(openSqlite(':memory:'), { ai }, impl)
    const c = client(on.app)
    expect((await c.get('/api/assistant')).json).toEqual({ enabled: true })
    const res = await c.post('/api/assistant', { messages: [{ role: 'user', content: 'hi' }], context: ctx })
    expect(res.json).toEqual({ reply: 'Hi! How can I help?', actions: [] })
    for (let i = 0; i < 14; i++) await c.post('/api/assistant', { messages: [{ role: 'user', content: 'hi' }], context: ctx })
    expect((await c.post('/api/assistant', { messages: [{ role: 'user', content: 'hi' }], context: ctx })).status).toBe(429)
  })
})
