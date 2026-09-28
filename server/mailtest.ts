// Checks the email settings by sending one test message: `npm run mail:test -- you@example.com`.
// Reads SMTP_URL and MAIL_FROM from .env (or the environment), so run it wherever the server will run.
import nodemailer from 'nodemailer'

const to = process.argv[2]
const url = process.env.SMTP_URL
const from = process.env.MAIL_FROM ?? 'Lanemark <no-reply@lanemark.local>'

if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
  console.error('Usage: npm run mail:test -- you@example.com')
  process.exit(1)
}
if (!url) {
  console.error('SMTP_URL is not set. Add it to .env (see .env.example), then run this again.')
  process.exit(1)
}

// Never print the URL itself: it contains the password.
const where = (() => {
  try {
    const u = new URL(url)
    return `${decodeURIComponent(u.username)} on ${u.hostname}:${u.port || (u.protocol === 'smtps:' ? 465 : 587)}`
  } catch {
    return 'the SMTP server'
  }
})()

const transport = nodemailer.createTransport(url)
try {
  console.log(`Signing in as ${where}…`)
  await transport.verify()
  console.log('Signed in. Sending a test email…')
  const info = await transport.sendMail({
    from,
    to,
    subject: 'Lanemark email test',
    text: 'If you can read this, Lanemark can send email: sign-up confirmations, password resets and pilot requests will arrive.',
  })
  console.log(`Sent to ${to} from ${from} (message ${info.messageId}). Check the inbox, and the spam folder the first time.`)
} catch (err) {
  const e = err as { code?: string; responseCode?: number; message: string }
  const hint =
    e.code === 'EAUTH' || e.responseCode === 535
      ? 'The mail server rejected the username or password. Check both in SMTP_URL (an @ or : in the password must be written as %40 or %3A).'
      : e.code === 'ESOCKET' || e.code === 'ECONNECTION' || e.code === 'ETIMEDOUT'
        ? 'Could not reach the mail server. Check the host and port in SMTP_URL.'
        : 'The mail server refused the message.'
  console.error(`${hint}\n(${e.code ?? e.responseCode ?? 'error'}: ${e.message})`)
  process.exitCode = 1
} finally {
  transport.close()
}
