#!/usr/bin/env node
/**
 * One command to bring Lanemark up to date and publish it, on Linux, macOS and Windows:
 *
 *   1. pull the latest from GitHub
 *   2. install packages if they changed
 *   3. regenerate docs/GUIDE.md from the Help page's content
 *   4. type-check, test, lint and build
 *   5. commit your changes and push them to GitHub
 *   6. deploy to Fly and check the live site is running this build
 *
 * Run it from anywhere:  ./ship.sh (Linux, macOS)  ·  ship.cmd (Windows)  ·  npm run ship -- [options]
 * It stops at the first thing that fails, and says what to do about it.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

const HELP = `
Usage: ./ship.sh [options]        (Windows: ship [options])

Pulls, checks, commits, pushes and deploys Lanemark in one go.

Options
  -m, --message "text"   Commit message for your changes (otherwise it asks)
  --no-commit            Don't commit anything; push and deploy what's already committed
  --quick                Skip the tests and lint (still type-checks and builds)
  --no-deploy            Stop after pushing to GitHub
  --secrets              Also copy these settings from .env to Fly before deploying:
                         SMTP_URL, MAIL_FROM, CONTACT_EMAIL, VOIDAI_API_KEY, AI_MODEL,
                         AI_BASE_URL, MONGODB_URI, MONGODB_DB (only the ones that are set)
  --shots                Retake the Help screenshots first (needs Chrome or Chromium)
  --dry-run              Pull and check, then show what would be committed, pushed and deployed
  -h, --help             Show this

Examples
  ./ship.sh -m "fix: typo on the pricing page"
  ./ship.sh --quick --no-deploy
`

// The settings worth copying to the live server. Everything else in .env (APP_URL, SECRET_KEY, PORT…) is about this
// computer and would break the live site.
const SECRET_KEYS = ['SMTP_URL', 'MAIL_FROM', 'CONTACT_EMAIL', 'VOIDAI_API_KEY', 'AI_MODEL', 'AI_BASE_URL', 'MONGODB_URI', 'MONGODB_DB']

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(root)
const windows = process.platform === 'win32'
const color = process.stdout.isTTY && !process.env.NO_COLOR
const paint = (code) => (s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s)
const bold = paint('1')
const dim = paint('2')
const green = paint('32')
const red = paint('31')
const yellow = paint('33')
const cyan = paint('36')

// Arguments
const args = process.argv.slice(2)
const opts = { message: '', commit: true, quick: false, deploy: true, secrets: false, shots: false, dry: false }
for (let i = 0; i < args.length; i++) {
  const a = args[i]
  if (a === '-h' || a === '--help') {
    console.log(HELP)
    process.exit(0)
  } else if (a === '-m' || a === '--message') opts.message = args[++i] ?? ''
  else if (a === '--no-commit') opts.commit = false
  else if (a === '--quick') opts.quick = true
  else if (a === '--no-deploy') opts.deploy = false
  else if (a === '--secrets') opts.secrets = true
  else if (a === '--shots') opts.shots = true
  else if (a === '--dry-run') opts.dry = true
  else fail(`Unknown option: ${a}`, 'Run with --help to see the options.')
}

// Helpers
const started = Date.now()
let stepNo = 0
function step(title) {
  stepNo++
  console.log(`\n${cyan(bold(`${stepNo}.`))} ${bold(title)}`)
}
function ok(text) {
  console.log(`   ${green('✓')} ${text}`)
}
function note(text) {
  console.log(`   ${dim(text)}`)
}
function warn(text) {
  console.log(`   ${yellow('!')} ${text}`)
}
function fail(text, hint) {
  console.error(`\n${red(bold('✗'))} ${bold(text)}`)
  if (hint) console.error(`  ${hint}`)
  process.exit(1)
}

/**
 * On Windows, npm and npx are .cmd files, which Node only starts through the shell. Nothing else goes through it, so
 * arguments with spaces (commit messages, paths under C:\Program Files) arrive in one piece.
 */
const viaShell = (cmd) => windows && (cmd === 'npm' || cmd === 'npx')

/** Runs a command with its output shown. */
function run(cmd, cmdArgs, { hint, input, quiet = false } = {}) {
  const res = spawnSync(cmd, cmdArgs, {
    stdio: [input === undefined ? 'inherit' : 'pipe', quiet ? 'pipe' : 'inherit', quiet ? 'pipe' : 'inherit'],
    input,
    shell: viaShell(cmd),
    encoding: 'utf8',
  })
  if (res.error) fail(`Couldn't run ${cmd}: ${res.error.message}`, hint)
  if (res.status !== 0) fail(`${[cmd, ...cmdArgs].join(' ')} failed.`, hint ?? (quiet ? (res.stderr || res.stdout).trim() : undefined))
  return res.stdout ?? ''
}

/** Runs a command and returns what it printed, or null if it failed. */
function read(cmd, cmdArgs) {
  const res = spawnSync(cmd, cmdArgs, { encoding: 'utf8', shell: viaShell(cmd) })
  // Only the trailing newline goes: `git status --porcelain` lines start with meaningful spaces.
  return res.status === 0 ? res.stdout.trimEnd() : null
}

async function ask(question) {
  if (!process.stdin.isTTY) return ''
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(question)
  rl.close()
  return answer.trim()
}

/** flyctl on the PATH, or where Fly's installer puts it. */
function findFly() {
  for (const name of ['fly', 'flyctl']) if (read(name, ['version']) !== null) return name
  for (const file of windows ? ['flyctl.exe', 'fly.exe'] : ['fly', 'flyctl']) {
    const path = join(homedir(), '.fly', 'bin', file)
    if (existsSync(path)) return path
  }
  return null
}

// Can this computer ship?
const major = Number(process.versions.node.split('.')[0])
if (major < 24) fail(`Lanemark needs Node 24 or newer (this is ${process.versions.node}).`, 'Install it from https://nodejs.org and run this again.')
if (read('git', ['--version']) === null) fail('Git isn’t installed.', 'Install it from https://git-scm.com and run this again.')
const top = read('git', ['rev-parse', '--show-toplevel'])
if (!top) fail('This folder isn’t a Git repository.', 'Clone Lanemark from GitHub, then run this from inside it.')
const branch = read('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
console.log(bold(`Shipping Lanemark`) + dim(`  ·  branch ${branch}  ·  ${new Date().toLocaleString()}`))
if (opts.dry) note('Dry run: nothing will be committed, pushed or deployed.')

// Pull
step('Getting the latest from GitHub')
const before = read('git', ['rev-parse', 'HEAD'])
const upstream = read('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'])
if (!upstream) warn(`${branch} isn’t linked to a GitHub branch, so there’s nothing to pull. It’ll be pushed with --set-upstream.`)
else {
  run('git', ['pull', '--rebase', '--autostash'], {
    hint: 'Your changes clash with changes on GitHub. Fix the files Git lists, then run `git rebase --continue` and ship again.',
  })
  const after = read('git', ['rev-parse', 'HEAD'])
  ok(before === after ? 'Already up to date' : `Pulled ${read('git', ['rev-list', '--count', `${before}..${after}`])} new commit(s)`)
}

// Packages
step('Packages')
const lockChanged = before && read('git', ['diff', '--name-only', before, 'HEAD', '--', 'package-lock.json'])
if (!existsSync('node_modules') || lockChanged) {
  run('npm', ['install', '--no-audit', '--no-fund'], { hint: 'Check your internet connection and try again.' })
  ok('Installed')
} else ok('Nothing new to install')

// Docs and screenshots
if (opts.shots) {
  step('Retaking the Help screenshots')
  const port = 5290 + Math.floor(Math.random() * 50)
  const vite = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { stdio: 'ignore', shell: windows })
  try {
    let up = false
    for (let i = 0; i < 60 && !up; i++) {
      await new Promise((r) => setTimeout(r, 500))
      up = await fetch(`http://localhost:${port}/`).then(
        (r) => r.ok,
        () => false,
      )
    }
    if (!up) fail('The dev server didn’t start for the screenshots.')
    const shots = spawnSync(process.execPath, ['scripts/guide-shots.mjs'], { stdio: 'inherit', env: { ...process.env, BASE: `http://localhost:${port}` } })
    if (shots.status !== 0) fail('Taking the screenshots failed.', 'Is Chrome or Chromium installed? Set CHROME to its path if it isn’t found.')
  } finally {
    // On Windows the server runs under a shell, so stop the whole process tree.
    if (windows) spawnSync('taskkill', ['/pid', String(vite.pid), '/T', '/F'], { stdio: 'ignore' })
    else vite.kill()
  }
  ok('Screenshots updated')
}
step('Help guide (docs/GUIDE.md)')
run(process.execPath, ['scripts/guide-md.ts'], { quiet: true })
ok('Up to date with the Help page')

// Checks
step(opts.quick ? 'Type-check and build (quick)' : 'Type-check, test, lint and build')
run('npx', ['tsc', '-b'], { hint: 'Fix the type errors above, then ship again.' })
ok('Types')
if (!opts.quick) {
  run('npx', ['vitest', 'run', '--reporter=dot'], { hint: 'A test failed (see above). Fix it, then ship again.' })
  ok('Tests')
  // --deny-warnings makes warnings fail too; the exit code is the verdict (the summary line always says
  // "0 warnings and 0 errors" on a clean run, so don't search the text for those words).
  const lint = spawnSync('npx', ['oxlint', '--deny-warnings'], { encoding: 'utf8', shell: windows })
  if (lint.status !== 0) {
    console.log(lint.stdout + lint.stderr)
    fail('The linter found problems (above).', 'Fix them, then ship again.')
  }
  ok('Lint')
}
run('npx', ['vite', 'build', '--logLevel', 'warn'], { hint: 'The build failed (see above).' })
ok('Built')

// Commit and push
step('Saving to GitHub')
const changes = read('git', ['status', '--porcelain', '--', '.'])
if (changes && !opts.commit) warn('You have changes that won’t be committed (--no-commit). The live site gets them anyway, GitHub doesn’t.')
if (changes && opts.commit) {
  console.log(
    changes
      .split('\n')
      .map((l) => `     ${dim(l)}`)
      .join('\n'),
  )
  let message = opts.message
  if (!message && !opts.dry) message = await ask(`   Commit message for these changes (leave empty to stop): `)
  if (!message && !opts.dry) fail('Stopped without committing.', 'Run again with -m "what you changed", or --no-commit to leave them out.')
  if (opts.dry) note(`Would commit ${changes.split('\n').length} changed file(s).`)
  else {
    run('git', ['add', '-A', '--', '.'])
    // Belt and braces: .gitignore already keeps these out.
    const staged = read('git', ['diff', '--cached', '--name-only']) ?? ''
    const risky = staged.split('\n').filter((f) => /(^|\/)\.env(\.|$)(?!example)|(^|\/)\.claude\//.test(f))
    if (risky.length) {
      run('git', ['reset', '-q', '--', ...risky])
      fail(`Refusing to commit secrets: ${risky.join(', ')}`, 'They’ve been unstaged. Check your .gitignore.')
    }
    run('git', ['commit', '-q', '-m', message])
    ok(`Committed: ${message}`)
  }
} else if (!changes) ok('No changes to commit')

const ahead = upstream ? Number(read('git', ['rev-list', '--count', '@{u}..HEAD']) ?? 0) : 1
if (opts.dry) note(ahead ? `Would push ${upstream ? ahead + ' commit(s)' : 'the branch'}.` : 'Nothing to push.')
else if (!ahead) ok('GitHub already has everything')
else {
  run('git', upstream ? ['push', '-q'] : ['push', '-q', '--set-upstream', 'origin', branch], {
    hint: 'Check you’re signed in to GitHub (`git push` should work on its own).',
  })
  ok(`Pushed to GitHub (${upstream ?? `origin/${branch}`})`)
}

// Deploy
if (!opts.deploy) {
  finish('Skipped deploying (--no-deploy).')
} else {
  step('Deploying to Fly')
  const fly = findFly()
  if (!fly)
    fail(
      'The Fly command line tool isn’t installed.',
      windows ? 'Install it: pwsh -Command "iwr https://fly.io/install.ps1 -useb | iex"' : 'Install it: curl -L https://fly.io/install.sh | sh',
    )
  const app = readFileSync('fly.toml', 'utf8').match(/^app\s*=\s*["']([^"']+)["']/m)?.[1]
  if (!app) fail('fly.toml doesn’t say which app to deploy.', 'Add a line like: app = "lanemark"')
  if (read(fly, ['auth', 'whoami']) === null) {
    if (opts.dry) fail('You’re not signed in to Fly.', `Run: ${fly} auth login`)
    warn('Signing in to Fly first (a browser window opens).')
    run(fly, ['auth', 'login'])
  }
  if (opts.secrets) {
    if (!existsSync('.env')) fail('--secrets needs a .env file here.', 'Copy .env.example to .env and fill it in.')
    const lines = readFileSync('.env', 'utf8')
      .split(/\r?\n/)
      .map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/))
      .filter((m) => m && SECRET_KEYS.includes(m[1]) && m[2] && !m[2].startsWith('#'))
      .map((m) => `${m[1]}=${m[2].replace(/^(['"])(.*)\1$/, '$2')}`)
    if (!lines.length) warn('.env has none of the settings to copy, so nothing was sent.')
    else if (opts.dry) note(`Would copy ${lines.map((l) => l.split('=')[0]).join(', ')} to Fly.`)
    else {
      // Values go over stdin, never on the command line or the screen.
      run(fly, ['secrets', 'import', '--app', app, '--stage'], { input: lines.join('\n') + '\n', quiet: true, hint: 'Fly didn’t accept the settings.' })
      ok(`Copied ${lines.map((l) => l.split('=')[0]).join(', ')} (they apply with this deploy)`)
    }
  }
  if (opts.dry) {
    note(`Would deploy ${app} and check https://${app}.fly.dev.`)
    finish('Dry run finished.')
  } else {
    run(fly, ['deploy', '--app', app, '--remote-only', '--ha=false'], { hint: `See the log above, or run: ${fly} logs --app ${app}` })
    ok('Deployed')

    step('Checking the live site')
    const url = `https://${app}.fly.dev`
    let healthy = false
    for (let i = 0; i < 12 && !healthy; i++) {
      healthy = await fetch(`${url}/api/health`).then(
        (r) => r.ok,
        () => false,
      )
      if (!healthy) await new Promise((r) => setTimeout(r, 2500))
    }
    if (!healthy) fail(`${url} isn’t answering.`, `Look at the logs: ${fly} logs --app ${app}`)
    const local = readFileSync('dist/index.html', 'utf8').match(/assets\/index-[\w-]+\.js/)?.[0]
    const live = (
      await fetch(url).then(
        (r) => r.text(),
        () => '',
      )
    ).match(/assets\/index-[\w-]+\.js/)?.[0]
    if (local && live === local) ok(`${url} is running this build`)
    else warn(`${url} is up, but its build doesn’t match this one yet. Give it a minute and reload.`)
    finish(`Live at ${url}`)
  }
}

function finish(text) {
  const secs = Math.round((Date.now() - started) / 1000)
  console.log(`\n${green(bold('Done'))} in ${secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${secs % 60}s`}. ${text}\n`)
  process.exit(0)
}
