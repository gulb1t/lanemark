import { motion } from 'motion/react'
import { ArrowLeft, Building2, Cookie, Database, Eye, HardDrive, KeyRound, Mail, ShieldCheck, Sparkles, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo, Wordmark } from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'

const GLANCE = [
  { icon: Eye, title: 'Only your team sees your classes', body: 'Rosters belong to the instructor’s account. In a pool, its supervisors can view them. Nothing is public or sold.' },
  { icon: HardDrive, title: 'Stored where you host it', body: 'One server and one database that your organisation runs, in the region you choose.' },
  { icon: Cookie, title: 'No tracking', body: 'No analytics, ads or third-party scripts. Cookies are only used to keep you signed in.' },
  { icon: Trash2, title: 'Deleted when you say', body: 'Swimmers, classes or the whole account can be deleted at any time, straight away.' },
]

const SECTIONS: { id: string; title: string; icon: typeof Eye; body: ReactNode }[] = [
  {
    id: 'what',
    title: 'What SwimTrack stores',
    icon: Database,
    body: (
      <>
        <p>Only what an instructor already writes on a paper report card, plus what an account needs to work.</p>
        <Table
          rows={[
            ['Instructor account', 'Name, email address, a salted scrypt hash of the password (never the password itself), and the two-factor secret, encrypted with AES-256-GCM.'],
            ['Swimmers', 'Name, optional photo (shrunk on the device before upload), optional notes.'],
            ['Classes', 'Level, session, schedule, lesson dates and topics, attendance marks, skill marks, report card comments and the recommended next level.'],
            ['Sessions', 'A hashed session token, the device’s browser name and a shortened IP address (the last part is dropped before saving), so you can see and sign out your devices. If you tick “don’t ask for a code on this device”, a hashed 30-day trusted-device mark is kept too.'],
            ['Emailed links', 'A hash of each confirm-email or reset-password link, deleted once it expires (24 hours or 30 minutes).'],
            ['Pools', 'If you join or start one: the pool’s name and invite code, who is in it, each person’s role (supervisor or instructor) and when they joined.'],
          ]}
        />
        <p>
          SwimTrack never asks for birthdays, addresses, parent contact details, health information or anything else a report card doesn’t need. Use first names and last
          initials if your program prefers.
        </p>
      </>
    ),
  },
  {
    id: 'where',
    title: 'Where it lives',
    icon: HardDrive,
    body: (
      <>
        <p>
          <b>On the server.</b> SwimTrack is one Node.js server with one database: a SQLite file on the server’s disk, or a MongoDB cluster. Whoever deploys it chooses the
          host and region. A municipality can run it on its own infrastructure or a Canadian cloud region, so records stay under its control.
        </p>
        <p>
          <b>On the instructor’s device.</b> So it works on deck without Wi-Fi, the app keeps a copy of that instructor’s classes in the browser’s storage and syncs changes
          when the connection returns. Signing out removes the copy from the device.
        </p>
        <p>
          <b>Nowhere else.</b> Fonts and code are served by the same server. There are no analytics, ad networks or crash reporters. The only outside services are the email provider for account email and, if it’s turned on, the assistant (see below).
        </p>
      </>
    ),
  },
  {
    id: 'who',
    title: 'Who can see it',
    icon: Eye,
    body: (
      <>
        <p>Each instructor account only ever reads and writes its own classes and swimmers. There is no public page and no search.</p>
        <p>
          <b>Pools.</b> An instructor can join their facility’s pool with an invite code from a supervisor, and the join screen says what that shares. The pool’s
          supervisors can then view that instructor’s classes: swimmers’ names, photos and notes, attendance, skill marks, report card comments and next levels, and
          they can print the report cards or download a class as a spreadsheet. They can’t change anything. Supervisors also see members’ names and email addresses.
          Other instructors in the pool never see each other’s classes; if a supervisor turns on the leaderboard, they see names and caught-up scores only. Swimmers are
          never ranked. Leaving the pool, or being removed from it, ends a supervisor’s access straight away.
        </p>
        <p>
          People who administer the server and its database can technically access stored records, as with any system. Limit that access the way you would for any
          system holding participant records.
        </p>
      </>
    ),
  },
  {
    id: 'security',
    title: 'How it’s protected',
    icon: ShieldCheck,
    body: (
      <ul>
        <li>Production requires HTTPS: cookies are Secure-only, with HSTS and a strict Content Security Policy.</li>
        <li>Passwords hashed with scrypt; sign-in attempts are rate limited per address and per account.</li>
        <li>Optional two-factor authentication with any authenticator app, plus one-time recovery codes.</li>
        <li>HttpOnly, SameSite session cookies with origin checks on every change, so other sites can’t act as you.</li>
        <li>A list of signed-in devices in Settings, with sign-out for any of them. Changing or resetting a password signs out other devices.</li>
        <li>Email alerts when the password or email address changes, or two-factor authentication is turned off.</li>
      </ul>
    ),
  },
  {
    id: 'email',
    title: 'Email',
    icon: Mail,
    body: (
      <p>
        SwimTrack only sends account email: confirming an address, password reset links and security alerts. No newsletters or marketing. Messages go through the SMTP
        provider the server is configured with.
      </p>
    ),
  },
  {
    id: 'assistant',
    title: 'The assistant',
    icon: Sparkles,
    body: (
      <>
        <p>
          The optional “Ask” assistant is the one feature that uses an outside service: an AI model reached through the provider the server is configured with (VoidAI by
          default). It’s only on when the server has a key for it.
        </p>
        <ul>
          <li>
            <b>What it sends:</b> the question you type, the page you’re on, and a summary of your classes: class names, levels, lesson and swimmer counts, how many report cards
            are done.
          </li>
          <li>
            <b>What it never sends:</b> swimmer names, photos, notes, attendance, skill marks or report card comments.
          </li>
          <li>Anything you type is sent as written, so leave swimmers’ personal details out of your questions.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'pilots',
    title: 'Pilot requests',
    icon: Building2,
    body: (
      <>
        <p>
          The “Request a pilot” form in the pricing section sends your name, email, organisation, number of pools and message to the SwimTrack team’s inbox, so we can
          reply. It isn’t saved in the app’s database, and nothing is emailed to the address you type in.
        </p>
      </>
    ),
  },
  {
    id: 'delete',
    title: 'Keeping and deleting data',
    icon: Trash2,
    body: (
      <>
        <p>Records stay until an instructor deletes them. Past sessions can be archived instead, which keeps them for reference.</p>
        <ul>
          <li>
            <b>A swimmer or class:</b> delete it from its page. It’s removed from the server on the next sync, on every device.
          </li>
          <li>
            <b>Everything:</b> Settings → Account → Delete account removes the account, every class, swimmer and session immediately. It can’t be undone. If the
            account was a pool’s only supervisor, the pool closes and its instructors keep their own classes.
          </li>
          <li>
            <b>A copy for your records:</b> Settings → Data exports a JSON backup before deleting.
          </li>
        </ul>
        <p>Expired sessions and emailed links are removed automatically.</p>
      </>
    ),
  },
  {
    id: 'accounts',
    title: 'Account security tips for instructors',
    icon: KeyRound,
    body: (
      <ul>
        <li>Turn on two-factor authentication in Settings → Security.</li>
        <li>Use a phone passcode, and sign out of shared deck tablets when you’re done.</li>
        <li>Leave attendance and behaviour out of comments, as the report card manual asks.</li>
      </ul>
    ),
  },
]

export default function Privacy() {
  return (
    <div className="relative min-h-dvh">
      <div className="ambient" aria-hidden />
      <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <Link to="/" className="flex items-center gap-2.5" aria-label="SwimTrack home">
          <Logo size={30} />
          <Wordmark />
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/" className="hidden items-center gap-1.5 text-sm text-muted hover:text-fg sm:flex">
            <ArrowLeft size={15} /> Home
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-4 pb-24 pt-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="max-w-2xl">
          <p className="eyebrow mb-3">Privacy and data handling</p>
          <h1 className="page-title !text-[clamp(2.3rem,6vw,3.6rem)]">
            Kids’ records, <span className="accent">handled with care.</span>
          </h1>
          <p className="mt-4 text-[16.5px] leading-relaxed text-muted">
            A plain-language summary for aquatics supervisors, privacy officers and IT teams: what SwimTrack keeps, where it’s kept, who can see it and how to remove it.
          </p>
        </motion.div>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {GLANCE.map(({ icon: Icon, title, body }, i) => (
            <motion.div key={title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.06, duration: 0.5 }} className="card p-5">
              <span className="icon-tile size-10 !rounded-xl !shadow-none">
                <Icon size={18} />
              </span>
              <h2 className="mt-4 font-display text-[16px] font-bold">{title}</h2>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{body}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <nav aria-label="On this page" className="hidden lg:block">
            <ul className="sticky top-8 space-y-1 text-[13.5px]">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="block rounded-lg px-3 py-1.5 text-muted transition-colors hover:bg-fg/[0.05] hover:text-fg">
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="space-y-12">
            {SECTIONS.map(({ id, title, icon: Icon, body }) => (
              <section key={id} id={id} className="scroll-mt-8">
                <h2 className="flex items-center gap-3 font-display text-[1.5rem] font-bold tracking-tight">
                  <Icon size={20} className="text-aqua" /> {title}
                </h2>
                <div className="prose-st mt-4">{body}</div>
              </section>
            ))}
            <p className="border-t border-line pt-6 text-[13px] leading-relaxed text-dim">
              This page describes how the software works. Each organisation that runs SwimTrack is responsible for its own privacy notices and obligations (in Ontario, for
              example, MFIPPA for municipalities). It isn’t legal advice.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

function Table({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="card my-5 divide-y divide-line overflow-hidden !rounded-2xl">
      {rows.map(([k, v]) => (
        <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4">
          <dt className="text-[14px] font-semibold">{k}</dt>
          <dd className="text-[14px] leading-relaxed text-muted">{v}</dd>
        </div>
      ))}
    </dl>
  )
}
