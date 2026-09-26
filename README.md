# SwimTrack

**Every length, logged.** Attendance, lesson plans, skill check-offs and report cards for swim instructors, built on the Lifesaving Society **Swim for Life** curriculum (Parent & Tot through Bronze Star, plus Teen/Adult: 21 levels, 265 skills with distances and must-see comments).

- **Offline-first.** Every edit saves on the device instantly and syncs in the background, and a service worker keeps the app itself on the device, so it opens and works with no signal at all. Pool Wi-Fi drops, nothing is lost.
- **Real accounts.** Email confirmation and password reset over SMTP, scrypt-hashed passwords, httpOnly session cookies, TOTP two-factor with recovery codes, device management and security alerts.
- **Report card workspace.** Checklist, one-tap comment chips built from the manual's must-sees, live rule checks and a letter-size print preview, swimmer by swimmer.
- **Private by design.** No analytics or third parties. See the in-app privacy page at `/privacy`.
- **Your database.** Built-in SQLite with zero setup, or your MongoDB Atlas cluster with one environment variable.

## Quick start

```bash
npm install
npm run seed      # optional: creates a local test account with two sample classes
npm run dev       # web on http://localhost:5173, API on :8787
```

`npm run seed` prints the test account's email and password (they're defined in `server/seed.ts`). You can also click **Try the live demo**, which needs no account and keeps everything in the browser.

Offline works on the dev server too, once a page has been opened (service workers need `localhost` or HTTPS, so testing from a phone over a LAN IP won't cache).

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite + API with hot reload (the API restarts on server changes) |
| `npm test` | 97 tests: crypto vectors, auth/2FA/CSRF, email verification and password reset, sync, SQLite **and** MongoDB storage, report card rules, UI logic |
| `npm run build` | Type-check everything and build the frontend into `dist/` |
| `npm start` | Production server: API + built frontend on one port |
| `npm run seed` | Create the local test account (refuses to run in production) |
| `npm run lint` | oxlint |

Requires **Node 24+** (Node 26 recommended). The server runs TypeScript natively and uses the built-in `node:sqlite`, so there's no build step for the backend.

## Using MongoDB Atlas

1. In Atlas: create a free M0 cluster, a database user, and allow your server's IP under **Network Access**.
2. Copy the connection string (Connect → Drivers).
3. Set `MONGODB_URI` (and `SECRET_KEY` in production) in `.env` or your host's settings. See `.env.example`.

The server logs `storage: mongo` on start. Indexes (unique email, session TTL, sync cursor) are created automatically. The same storage contract tests run against both SQLite and a real MongoDB (`mongodb-memory-server`).

## Email

Accounts use real email: a confirmation link on sign-up, "Forgot password?" reset links (single use, 30 minutes), confirmed email changes, and security notices when the password, email or two-factor setting changes. Links are stored only as hashes, like sessions.

- **Development:** with no `SMTP_URL`, nothing is sent. Messages appear at [localhost:5173/api/dev/outbox](http://localhost:5173/api/dev/outbox) and in the API log, so every flow can be clicked through.
- **Real delivery:** set `SMTP_URL`, `MAIL_FROM` and `APP_URL` (see `.env.example`). Any SMTP provider works; with Gmail, turn on 2-Step Verification, create an app password and use `smtps://you%40gmail.com:app-password@smtp.gmail.com:465`.
- **Pilot requests:** the “Request a pilot” form in the landing page's pricing section emails `CONTACT_EMAIL` (replies go straight to the requester). In development it lands in the outbox; in production the form stays off until `CONTACT_EMAIL` is set.

## Assistant

The **Ask** button in the app opens an assistant that finds pages, explains features and looks up any level's skills and must-sees (it runs curriculum lookups on the server, so skill answers come from the real data). Set `VOIDAI_API_KEY` (or any OpenAI-compatible `AI_BASE_URL` + key) to turn it on; `AI_MODEL` defaults to `gpt-4.1-mini`, which answered fastest and most accurately in testing (2–3 s). It only ever receives class summaries, never swimmer names or records, and it's rate limited per account, per address and per hour overall. The dev scripts read `.env` automatically.

## Deploying

It's one Node process that serves the API and the built site.

```bash
npm ci && npm run build
NODE_ENV=production APP_URL=https://swim.example.ca SECRET_KEY=$(openssl rand -base64 32) npm start
```

- Put it behind HTTPS (Railway, Render, Fly.io, or any VPS with Caddy/nginx). Production cookies are `Secure` and `__Host-` prefixed.
- With SQLite, give `DATA_DIR` a persistent volume. With Atlas, no disk is needed.
- Behind a proxy, set `TRUST_PROXY=1` so rate limits see real client IPs.

### Sharing it from your computer (phones, a quick demo)

```bash
npm run tunnel
```

Builds the app, opens a free Cloudflare quick tunnel (needs `cloudflared` installed) and starts the production server behind it, then prints a `https://….trycloudflare.com` address. Use this rather than tunnelling `npm run dev`: the dev server sends React's slow development build as hundreds of separate files, which stutters on phones. The address changes every run and is filled in as `APP_URL` for you. Accounts are the same as in development (same `data` folder), but you'll sign in again because production cookies are separate. `npm run tunnel -- --no-build` skips the build.

## Architecture

```
src/                 React 19 + Vite + Tailwind v4 + Motion
  sync/engine.ts     offline-first sync: diff edits → queue → IndexedDB cache → POST /api/sync
  store/             Zustand stores: data (useStore), session, UI (toasts/undo/confirm)
  data/              curriculum presets and report-card must-sees
  pages/, components/
server/              Hono on Node
  app.ts             routes: auth, 2FA, sessions, account, sync
  auth/              scrypt passwords, RFC 6238 TOTP, recovery codes
  db/                Repo interface + SQLite and MongoDB implementations
```

**Sync.** Classes and swimmers are documents. The client diffs every store change by reference, queues the touched documents, and pushes them in one `POST /api/sync` that also returns everything changed on other devices since its cursor (tombstones included). Documents edited while a request is in flight keep their local version, so nothing is clobbered. The last write wins per document.

**Security.** scrypt (N=2¹⁵, r=8, p=3) password hashing with constant-time checks and dummy work for unknown emails. Opaque 256-bit session tokens (only hashes are stored), httpOnly + SameSite=Lax cookies with sliding 30-day expiry. CSRF: writes need a same-origin `Origin` and a JSON body. Per-IP and per-account rate limits. TOTP secrets are AES-256-GCM encrypted at rest, with replay protection and 10 single-use recovery codes. A second factor is required to disable 2FA or delete the account. Strict CSP, HSTS in production, and zod validation of every synced document.

## Running a 5-minute pitch demo

1. `npm run build && NODE_ENV=production APP_URL=http://localhost:8787 npm start` (or just `npm run dev`), then open the site in a fresh browser window.
2. **Landing (1 min):** the water reacts to the cursor, toys float by (tap one), and the depth gauge on the right tracks the scroll. Click through the product tour tabs, then show "How a session works" and the privacy page.
3. **Try the live demo (3 min):** it opens on a class that is teaching *today*.
   - Dashboard: today's class first, and a to-do list (last week's missed attendance, report cards due, skills to assess).
   - **Take attendance** → *Rest present* → tap one swimmer late: the lesson-done moment appears.
   - Class → **Report cards** → *Continue writing*: tap chips to build a comment, watch the rule warnings and the printed card update, flip swimmers with ← →, then **Print → Whole class**.
4. **Supervisor angle (1 min):** every card follows the manual's wording and rules, prints on letter paper, and the data stays on a server the city runs (`/privacy`).

To start the demo over, use Settings → Data → Reset demo (or a private window).

## Curriculum sources

- report card writing guide (item names, must-see comments, report templates)
- Lifesaving Society Swim for Life *At-a-Glance* guides (skills and distances)

Levels are presets: every class gets its own editable copy of its skills.

## Roadmap

See [docs/MOBILE.md](docs/MOBILE.md) for the Android (APK) and iOS plan.
