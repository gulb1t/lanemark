# Hosting SwimTrack

SwimTrack is one Node process that serves both the site and the API, with its database in a single folder
(SQLite) or on MongoDB Atlas. Anything that can run a Docker image with a small persistent disk can host it.

| Option | Where the data lives | Effort | Good for |
|---|---|---|---|
| **A. Fly.io** | Toronto (Canada) | ~15 minutes, command line | The pitch and a real pilot |
| **B. Railway** | US or EU | ~10 minutes, all in the browser | The quickest always-on demo |
| **C. Your laptop + `npm run tunnel`** | Your laptop | 1 command | Showing it for an afternoon |

For a real pilot, **A** is the one to use: the privacy page and FAQ say a city can keep swimmer data
in Canada, and this does.

## Settings you'll set on any host

| Variable | What it's for |
|---|---|
| `APP_URL` | The public address, e.g. `https://my-swimtrack.fly.dev`. Emailed links use it. **Required.** |
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

2. In `fly.toml`, change `app = "swimtrack"` to a unique name, e.g. `my-swimtrack`. Then, from the
   `SwimTrack` folder:

   ```bash
   fly apps create my-swimtrack
   fly volumes create swimtrack_data --region yyz --size 1
   fly secrets set APP_URL=https://my-swimtrack.fly.dev SECRET_KEY="$(openssl rand -base64 32)"
   fly secrets set SMTP_URL='smtps://…' MAIL_FROM='SwimTrack <you@gmail.com>' CONTACT_EMAIL=you@gmail.com
   fly secrets set VOIDAI_API_KEY=…
   fly deploy
   ```

3. Open `https://my-swimtrack.fly.dev`. `fly logs` shows the server log.

**Updating it later:** run `./ship.sh` (Windows: `ship`) from the `SwimTrack` folder. It pulls, checks, commits,
pushes, deploys and checks the live site in one go. See "Updating the live site" in the README for its options.

**Backups:** `fly ssh sftp get /data/swimtrack.db` downloads the whole database. Each instructor can also
download their own data from Settings → Data → Backup.

**Your own domain:** `fly certs add swim.yourdomain.ca`, point the DNS record it shows you, then
`fly secrets set APP_URL=https://swim.yourdomain.ca`.

## B. Railway

1. On railway.com: **New project → Deploy from GitHub repo** and pick this repository. Set the root directory
   to `SwimTrack`. Railway finds the Dockerfile and builds it.
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
   written as `%40`) and `MAIL_FROM=SwimTrack <you@gmail.com>`.

Your own domain's mailbox works the same way, e.g. `smtps://contact%40gulb.it:password@mail.gulb.it:465`.
To check the settings, run `npm run mail:test -- you@example.com` (locally), or `fly ssh console -C "node server/mailtest.ts you@example.com"` on Fly.

For a city deployment, use an address on your own domain through a provider like Resend or Postmark, so emails
don't come from a personal Gmail.

## MongoDB Atlas instead of SQLite

Set `MONGODB_URI` (and optionally `MONGODB_DB`) and SwimTrack uses Atlas instead of the `/data` folder. You then
don't need a volume, and Atlas handles backups. Choose the Atlas region `ca-central-1` to keep the data in Canada.
