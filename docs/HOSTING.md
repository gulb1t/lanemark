# Hosting Lanemark

Lanemark is one Node process that serves both the site and the API, with its database in a single folder
(SQLite) or on MongoDB Atlas. Anything that can run a Docker image with a small persistent disk can host it.

| Option | Where the data lives | Effort | Good for |
|---|---|---|---|
| **A. Fly.io** | Toronto (Canada) | ~15 minutes, command line | A real pilot |
| **B. Railway** | US, Europe or Asia | ~10 minutes, all in the browser | The quickest always-on demo |
| **C. Your laptop + `npm run tunnel`** | Your laptop | 1 command | Showing it for an afternoon |

If swimmer data has to stay in Canada (a city or school board will usually ask), use **A**: the privacy page and
FAQ promise that, and this keeps it.

## Settings you'll set on any host

| Variable | What it's for |
|---|---|
| `APP_URL` | The public address, e.g. `https://my-lanemark.fly.dev`. Emailed links use it. **Required.** |
| `SECRET_KEY` | Encrypts two-factor secrets. Make one with `openssl rand -base64 32` and keep it safe. |
| `SMTP_URL`, `MAIL_FROM` | So sign-up confirmations and password resets actually arrive (see "Email" below). |
| `CONTACT_EMAIL` | Where "Request a pilot" forms from the pricing section go. The form is off until this is set. |
| `VOIDAI_API_KEY` | Turns on the in-app assistant. Leave it out to hide the assistant. |

Accounts are always on: anyone can create one at `/signup`. Without `SMTP_URL`, confirmation and reset emails
aren't delivered; they're only written to the server log, so set up email before inviting real instructors.

## A. Fly.io (Toronto)

1. Install the CLI and sign up (Fly asks for a card; a single small machine costs a few dollars a month):

   ```bash
   curl -L https://fly.io/install.sh | sh
   fly auth signup
   ```

2. In `fly.toml`, change `app = "lanemark"` to a unique name, e.g. `my-lanemark`. Then, from the
   project folder:

   ```bash
   fly apps create my-lanemark
   fly volumes create lanemark_data --region yyz --size 1
   fly secrets set APP_URL=https://my-lanemark.fly.dev SECRET_KEY="$(openssl rand -base64 32)"
   fly secrets set SMTP_URL='smtps://…' MAIL_FROM='Lanemark <you@gmail.com>' CONTACT_EMAIL=you@gmail.com
   fly secrets set VOIDAI_API_KEY=…
   fly deploy
   ```

3. Open `https://my-lanemark.fly.dev`. `fly logs` shows the server log.

**Updating it later:** push to `main` and GitHub deploys it (add a Fly deploy token as the `FLY_API_TOKEN`
repository secret), or use `ship` from your own machine, below.

**Backups:** `fly ssh sftp get /data/lanemark.db` downloads the whole database. Each instructor can also
download their own data from Settings → Data → Backup.

**Your own domain:** `fly certs add swim.yourdomain.ca`, point the DNS record it shows you, then
`fly secrets set APP_URL=https://swim.yourdomain.ca`.

## B. Railway

1. On railway.com: **New project → Deploy from GitHub repo** and pick this repository (if the app sits in a
   subfolder, set that as the root directory). Railway finds the Dockerfile and builds it.
2. Add a **Volume** to the service, mounted at `/data`.
3. **Settings → Networking → Generate domain**, then under **Variables** set `APP_URL` to that address, plus
   `SECRET_KEY`, `TRUST_PROXY=1` and the email and assistant variables above.

Railway's regions are in the US, Europe and Asia, so don't use it if the data has to stay in Canada.

## C. Your laptop

```bash
npm run tunnel
```

This builds the app, starts it in production mode and prints a `https://….trycloudflare.com` address. It only
works while the laptop is on and awake, and the address changes every time. Tunnelling `npm run dev` also works
(sign-in through a trycloudflare.com address is allowed in development), but it serves the slow development
build, which stutters on phones.

## Email

Any SMTP provider works. The quickest is a Gmail account:

1. Turn on 2-Step Verification at myaccount.google.com.
2. Create an app password at myaccount.google.com/apppasswords.
3. Set `SMTP_URL=smtps://you%40gmail.com:the-app-password@smtp.gmail.com:465` (the `@` in the address is
   written as `%40`) and `MAIL_FROM=Lanemark <you@gmail.com>`.

Your own domain's mailbox works the same way, e.g. `smtps://you%40yourdomain.ca:password@mail.yourdomain.ca:465`.
To check the settings, run `npm run mail:test -- you@example.com` (locally), or `fly ssh console -C "node server/mailtest.ts you@example.com"` on Fly.

For a city deployment, use an address on your own domain through a provider like Resend or Postmark, so emails
don't come from a personal Gmail.

## MongoDB Atlas instead of SQLite

Set `MONGODB_URI` (and optionally `MONGODB_DB`) and Lanemark uses Atlas instead of the `/data` folder. You then
don't need a volume, and Atlas handles backups. Choose the Atlas region `ca-central-1` to keep the data in Canada.

## Shipping from your own machine

Once it's on Fly, `ship` does everything in order, and stops with a plain explanation if anything fails:

1. Pulls the latest from GitHub.
2. Installs packages if they changed.
3. Regenerates the Markdown guide.
4. Type-checks, tests, lints and builds.
5. Commits your changes (it asks for a message) and pushes.
6. Deploys to Fly and checks the live site is running the new build.

```bash
./ship.sh                      # Linux and macOS
```

```bat
ship                           :: Windows (Command Prompt or PowerShell, in this folder)
```

It works from any folder, and there's nothing to add to your PATH (`npm run ship` works too). The options:

| Option | What it does |
|---|---|
| `-m "what changed"` | Commit message, so it doesn't ask |
| `--no-commit` | Leave local changes out of Git; push and deploy what's committed |
| `--quick` | Skip tests and lint (still type-checks and builds) |
| `--no-deploy` | Stop after pushing to GitHub |
| `--secrets` | Also copy the email, assistant and MongoDB settings from `.env` to Fly. It never sends `APP_URL`, `SECRET_KEY` or other settings that only make sense on your computer, and never prints the values. |
| `--shots` | Retake the Help screenshots first (needs Chrome or Chromium) |
| `--dry-run` | Pull and check, then show what it would commit, push and deploy |

It needs Node 24+, Git, and the [Fly command line tool](https://fly.io/docs/flyctl/install/). It signs you in to Fly the first time.
