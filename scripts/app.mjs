#!/usr/bin/env node
/**
 * Builds the Android app. Works on Windows, macOS and Linux.
 *
 *   npm run app                 Build a test APK (installs on any phone that allows "unknown apps")
 *   npm run app -- --install    …and install it on the phone plugged in by USB (or a running emulator), then open it
 *   npm run app -- --release    Build the signed release: an APK to share and an AAB for the Play Store
 *   npm run app:keystore        Make the release signing key (once). Back it up: updates must use the same key.
 *
 * Needs Java 21 and the Android SDK. Android Studio installs both; the script also looks in ~/Android/jdk-21 and the
 * usual SDK folders, so JAVA_HOME and ANDROID_HOME are only needed when they're somewhere else.
 * APP_API_URL points the app at another server (default: the live one).
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const android = join(root, 'android')
const windows = platform() === 'win32'
const args = new Set(process.argv.slice(2))
const mode = args.has('keystore') ? 'keystore' : args.has('--release') ? 'release' : 'debug'

const bold = (s) => (process.stdout.isTTY ? `\x1b[1m${s}\x1b[0m` : s)
const green = (s) => (process.stdout.isTTY ? `\x1b[32m${s}\x1b[0m` : s)
const red = (s) => (process.stdout.isTTY ? `\x1b[31m${s}\x1b[0m` : s)
const step = (s) => console.log(`\n${bold(s)}`)
const ok = (s) => console.log(`   ${green('✓')} ${s}`)
function fail(message, hint) {
  console.log(`\n${red('✗')} ${message}`)
  if (hint) console.log(`  ${hint}`)
  process.exit(1)
}

// ── find Java and the Android SDK ──────────────────────────────────────
const home = homedir()
const firstExisting = (paths) => paths.find((p) => p && existsSync(p))
const javaHome = firstExisting([
  process.env.JAVA_HOME,
  join(home, 'Android', 'jdk-21'),
  windows ? 'C:\\Program Files\\Android\\Android Studio\\jbr' : null,
  platform() === 'darwin' ? '/Applications/Android Studio.app/Contents/jbr/Contents/Home' : null,
  '/opt/android-studio/jbr',
])
const sdk = firstExisting([
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  join(home, 'Android', 'Sdk'),
  windows ? join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk') : null,
  join(home, 'Library', 'Android', 'sdk'),
])
const env = { ...process.env, ...(javaHome ? { JAVA_HOME: javaHome } : {}), ...(sdk ? { ANDROID_HOME: sdk } : {}) }
const exe = (name) => (windows ? `${name}.exe` : name)
const keytool = javaHome ? join(javaHome, 'bin', exe('keytool')) : exe('keytool')
const adb = sdk ? join(sdk, 'platform-tools', exe('adb')) : exe('adb')

function run(cmd, argv, { cwd = root, hint, quiet = false } = {}) {
  // Only npx and gradlew.bat need a shell on Windows; everything else runs directly so arguments stay intact.
  const shell = windows && (cmd === 'npx' || cmd.endsWith('.bat'))
  const res = spawnSync(cmd, argv, { cwd, env, stdio: quiet ? 'pipe' : 'inherit', shell, encoding: 'utf8' })
  if (res.status !== 0) {
    if (quiet) console.log(res.stdout, res.stderr)
    fail(`${cmd} ${argv.join(' ')} failed.`, hint)
  }
  return res.stdout ?? ''
}

function ask(question, { hidden = false } = {}) {
  return new Promise((done) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    if (hidden) {
      // Don't echo what's typed.
      rl._writeToOutput = (s) => rl.output.write(s.includes(question) ? s : '')
    }
    rl.question(question, (answer) => {
      rl.close()
      if (hidden) console.log()
      done(answer)
    })
  })
}

// ── the release signing key ──────────────────────────────────────────
if (mode === 'keystore') {
  const props = join(android, 'keystore.properties')
  const store = join(android, 'lanemark-release.jks')
  if (existsSync(store)) fail('android/lanemark-release.jks already exists.', 'Keep using it: every update must be signed with the same key.')
  if (!javaHome) fail('Java 21 wasn’t found.', 'Install Android Studio (it includes Java), or set JAVA_HOME.')
  console.log(bold('Make the Lanemark release key'))
  console.log('This key signs every version of the app you publish. Choose a strong password and keep it with the key.')
  const password = await ask('Password (at least 8 characters): ', { hidden: true })
  if (password.length < 8) fail('That password is too short.')
  if ((await ask('Type it again: ', { hidden: true })) !== password) fail('The passwords didn’t match.')
  const name = (await ask('Your name or organisation (shown in the certificate): ')).trim() || 'Lanemark'
  const passEnv = { ...env, LANEMARK_KEY_PASS: password }
  const gen = spawnSync(
    keytool,
    ['-genkeypair', '-keystore', store, '-alias', 'lanemark', '-keyalg', 'RSA', '-keysize', '4096', '-validity', '10000', '-dname', `CN=${name.replace(/[,=+<>#;"\\]/g, ' ')}`, '-storepass:env', 'LANEMARK_KEY_PASS', '-keypass:env', 'LANEMARK_KEY_PASS'],
    { env: passEnv, stdio: 'inherit' },
  )
  if (gen.status !== 0) fail('keytool couldn’t make the key.')
  writeFileSync(props, `storeFile=lanemark-release.jks\nstorePassword=${password}\nkeyAlias=lanemark\nkeyPassword=${password}\n`, { mode: 0o600 })
  const list = spawnSync(keytool, ['-list', '-v', '-keystore', store, '-alias', 'lanemark', '-storepass:env', 'LANEMARK_KEY_PASS'], { env: passEnv, encoding: 'utf8' })
  const sha = list.stdout.match(/SHA256:\s*([0-9A-F:]{95})/)?.[1]
  if (sha) {
    const file = join(root, 'server', 'app-links.json')
    const links = JSON.parse(readFileSync(file, 'utf8'))
    if (!links.fingerprints.includes(sha)) links.fingerprints.push(sha)
    writeFileSync(file, JSON.stringify(links, null, 2) + '\n')
    ok(`Added the key’s fingerprint to server/app-links.json (ship the site so links open the app)`)
  }
  ok('Made android/lanemark-release.jks and android/keystore.properties (both stay out of git)')
  console.log(`\n${bold('Back up both files now')} (a password manager or a USB stick). If they're lost, the app can't be updated.`)
  process.exit(0)
}

// ── build ─────────────────────────────────────────────────────────────
if (!javaHome) fail('Java 21 wasn’t found.', 'Install Android Studio (it includes Java), or set JAVA_HOME.')
if (!sdk) fail('The Android SDK wasn’t found.', 'Install Android Studio (it installs the SDK), or set ANDROID_HOME.')
if (mode === 'release' && !existsSync(join(android, 'keystore.properties'))) fail('There’s no release key yet.', 'Run `npm run app:keystore` once first.')

step('1. Building the app’s screens')
run('npx', ['vite', 'build', '--mode', 'app', '--logLevel', 'warn'], { hint: 'Fix the build errors above.' })
ok(`Built for ${process.env.APP_API_URL ?? 'https://swimtrack.fly.dev'}`)

step('2. Copying them into the Android project')
run('npx', ['cap', 'sync', 'android'], { quiet: true })
ok('Synced')

step(mode === 'release' ? '3. Building the signed release' : '3. Building the test APK')
const gradlew = join(android, windows ? 'gradlew.bat' : 'gradlew')
run(gradlew, mode === 'release' ? ['assembleRelease', 'bundleRelease', '--console=plain', '-q'] : ['assembleDebug', '--console=plain', '-q'], { cwd: android, hint: 'The Android build failed (see above).' })
const out = join(android, 'app', 'build', 'outputs')
const apk = mode === 'release' ? join(out, 'apk', 'release', 'app-release.apk') : join(out, 'apk', 'debug', 'app-debug.apk')
ok(`APK: ${apk}`)
if (mode === 'release') ok(`Play Store bundle: ${join(out, 'bundle', 'release', 'app-release.aab')}`)

if (args.has('--install')) {
  step('4. Installing on your phone')
  const devices = run(adb, ['devices'], { quiet: true }).split('\n').slice(1).filter((l) => /\tdevice$/.test(l))
  if (!devices.length) fail('No phone found.', 'Plug it in by USB with USB debugging on (Settings → Developer options), or start an emulator.')
  run(adb, ['install', '-r', apk], { quiet: true, hint: 'If it says the signatures don’t match, uninstall Lanemark from the phone first.' })
  run(adb, ['shell', 'monkey', '-p', 'io.github.gulb1t.lanemark', '-c', 'android.intent.category.LAUNCHER', '1'], { quiet: true })
  ok('Installed and opened')
}
console.log(`\n${green('Done.')}`)
