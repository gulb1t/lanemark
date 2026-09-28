// Share the production build through a Cloudflare quick tunnel: `npm run tunnel`.
//
// Phones should never be pointed at the Vite dev server: it serves React's development build as hundreds of separate
// modules, which is slow over a tunnel. This builds the app, opens a trycloudflare.com tunnel, reads its address,
// then starts the production server with that address as APP_URL (so emailed links point at it) and listening on
// localhost only, so the tunnel is the one way in.
import { spawn, spawnSync } from 'node:child_process'

const PORT = process.env.TUNNEL_PORT ?? '8788'
const children = []
const stop = (code = 0) => {
  for (const c of children) c.kill('SIGTERM')
  process.exit(code)
}
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())

if (!process.argv.includes('--no-build')) {
  console.log('Building…')
  const build = spawnSync('npm', ['run', 'build'], { stdio: 'inherit' })
  if (build.status !== 0) process.exit(build.status ?? 1)
}

console.log('Opening the tunnel…')
const tunnel = spawn('cloudflared', ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${PORT}`], { stdio: ['ignore', 'pipe', 'pipe'] })
children.push(tunnel)
tunnel.on('error', () => {
  console.error('Couldn’t start cloudflared. Install it from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/')
  stop(1)
})
tunnel.on('exit', (code) => {
  console.error(`cloudflared stopped (${code}).`)
  stop(1)
})

const url = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('No tunnel address after 45 seconds.')), 45_000)
  const scan = (chunk) => {
    const found = String(chunk).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)
    if (found) {
      clearTimeout(timer)
      resolve(found[0])
    }
  }
  tunnel.stdout.on('data', scan)
  tunnel.stderr.on('data', scan)
}).catch((err) => {
  console.error(err.message)
  stop(1)
})

const server = spawn(process.execPath, ['--env-file-if-exists=.env', 'server/index.ts'], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production', PORT, HOST: '127.0.0.1', APP_URL: url, APP_ORIGINS: url, TRUST_PROXY: '1' },
})
children.push(server)
server.on('exit', (code) => stop(code ?? 1))

console.log(`\n  Lanemark is live at ${url}\n  (the address can take a few seconds to start answering; Ctrl+C stops everything)\n`)
