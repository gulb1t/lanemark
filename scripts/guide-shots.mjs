#!/usr/bin/env node
/**
 * Takes the screenshots used by the Help page, docs/GUIDE.md and the README, from the demo, in light and dark.
 *
 *   npm run dev            (in another terminal)
 *   npm run guide:shots    (BASE=http://localhost:5173 and CHROME=chromium by default)
 *
 * Writes public/guide/<name>-<light|dark>.webp and src/data/guideShots.json (their sizes, so pages don't jump
 * while the images load). Uses Chrome's DevTools protocol directly, so there's nothing extra to install.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = process.env.BASE ?? 'http://localhost:5173'
const CHROME = process.env.CHROME ?? 'chromium'
const OUT = 'public/guide'
const SCALE = 1.5
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Hides what isn't part of the screen being shown: the demo banner, the Ask button, toasts and the film grain. */
const HIDE = `
  .grain, [data-sonner-toaster], button[aria-label="Ask the SwimTrack assistant"] { display: none !important; }
  nav[aria-label="Swimmers"] { display: none !important; }
  *, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; }
`

const click = (text) => `[...document.querySelectorAll('button, a')].find((el) => el.textContent.trim() === ${JSON.stringify(text)})?.click()`
const tab = (id) => `document.querySelector('[data-tour="tab-${id}"]')?.click()`
/** Page-coordinate box of the first match, trimmed to `max` pixels tall. */
const box = (selector, { pad = 0, max = Infinity, trim = 0 } = {}) =>
  `(() => { const r = document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect(); if (!r) return null;
     return { x: r.left - ${pad}, y: r.top + scrollY - ${pad} + ${trim}, width: r.width + ${pad * 2}, height: Math.min(r.height + ${pad * 2} - ${trim}, ${max}) } })()`

/** Each shot: where to go, what to click first, and what part of the page to keep. */
const SHOTS = [
  { name: 'dashboard', path: '/app', area: box('main', { max: 740, trim: 24 }) },
  { name: 'new-class', path: '/app', setup: [`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' }))`], area: box('dialog[open]', { pad: 20 }) },
  {
    name: 'add-swimmers',
    path: 'class',
    setup: [click('Add swimmers'), `[...document.querySelectorAll('dialog[open] input[type=checkbox]')].slice(0, 2).forEach((c) => c.click())`],
    area: box('dialog[open]', { pad: 20 }),
  },
  { name: 'attendance', path: 'class', setup: [tab('attendance')], area: box('[role=tabpanel]', { pad: 8, max: 640 }) },
  { name: 'skills', path: 'class', setup: [tab('skills')], area: box('[role=tabpanel]', { pad: 8, max: 600 }) },
  { name: 'lessons', path: 'class', setup: [tab('lessons')], area: box('[role=tabpanel]', { pad: 8, max: 480 }) },
  {
    name: 'report-card',
    path: 'report',
    setup: [click('Write it for me')],
    area: `(() => { const s = [...document.querySelectorAll('main section.card')]; const a = s[1].getBoundingClientRect(), b = s[2].getBoundingClientRect();
      return { x: a.left - 8, y: a.top + scrollY - 8, width: a.width + 16, height: b.bottom - a.top + 16 } })()`,
  },
  { name: 'preview', path: 'report', setup: [click('Write it for me'), `document.querySelector('[data-tour=report-preview]').click()`], area: box('dialog[open]', { pad: 20, max: 760 }) },
  { name: 'pool', path: '/app/pool', area: box('main', { max: 880, trim: 24 }) },
]

async function browser(scheme) {
  const port = 9600 + Math.floor(Math.random() * 300)
  const profile = mkdtempSync(join(tmpdir(), 'swimtrack-shots-'))
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' })
  const stop = () => {
    chrome.kill('SIGKILL')
    rmSync(profile, { recursive: true, force: true })
  }
  process.on('exit', stop)
  let target
  for (let i = 0; i < 80 && !target; i++) {
    await sleep(150)
    target = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })
      .then((r) => r.json())
      .catch(() => null)
  }
  if (!target) throw new Error(`Couldn't start ${CHROME}. Set CHROME to your Chrome or Chromium binary.`)
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))
  let id = 0
  const pending = new Map()
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data)
    if (d.id && pending.has(d.id)) pending.get(d.id)(d)
  }
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const n = ++id
      pending.set(n, resolve)
      ws.send(JSON.stringify({ id: n, method, params }))
    })
  const run = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 860, deviceScaleFactor: SCALE, mobile: false })
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] })
  const go = async (url) => {
    await send('Page.navigate', { url })
    await sleep(2200)
    await run(`document.head.insertAdjacentHTML('beforeend', ${JSON.stringify(`<style>${HIDE}</style>`)})`)
  }
  return { send, run, go, close: () => (ws.close(), stop()) }
}

const sizes = {}
mkdirSync(OUT, { recursive: true })
for (const scheme of ['light', 'dark']) {
  const b = await browser(scheme)
  // Skip the guided tours and start the demo from scratch.
  await b.go(`${BASE}/`)
  await b.run(`localStorage.clear(); localStorage.setItem('swimtrack:tour:all', '1'); localStorage.setItem('swimtrack:theme', 'system')`)
  await b.go(`${BASE}/demo`)
  await sleep(1500)
  await b.run(`document.querySelector('button[aria-label="Hide"]')?.click()`)
  const cls = await b.run(`document.querySelector('a[href^="/app/classes/"]')?.getAttribute('href')`)
  if (!cls) throw new Error('The demo has no classes. Is the dev server running at ' + BASE + '?')
  await b.go(`${BASE}${cls}?tab=reports`)
  const report = await b.run(`document.querySelector('a[href*="/reports/"]')?.getAttribute('href')`)
  const paths = { class: cls, report }

  for (const shot of SHOTS) {
    await b.go(`${BASE}${paths[shot.path] ?? shot.path}`)
    await b.run(`document.querySelector('button[aria-label="Hide"]')?.click()`)
    for (const step of shot.setup ?? []) {
      await b.run(step)
      await sleep(700)
    }
    await b.run('window.scrollTo(0, 0)')
    await sleep(500)
    const clip = await b.run(shot.area)
    if (!clip) throw new Error(`Nothing to capture for ${shot.name}`)
    const r = await b.send('Page.captureScreenshot', { format: 'webp', quality: 82, captureBeyondViewport: true, clip: { ...clip, scale: 1 } })
    writeFileSync(`${OUT}/${shot.name}-${scheme}.webp`, Buffer.from(r.result.data, 'base64'))
    sizes[shot.name] = { width: Math.round(clip.width), height: Math.round(clip.height) }
    console.log(`${shot.name}-${scheme}.webp  ${sizes[shot.name].width}×${sizes[shot.name].height}`)
  }
  b.close()
}
writeFileSync('src/data/guideShots.json', JSON.stringify(sizes, null, 2) + '\n')
process.exit(0)
