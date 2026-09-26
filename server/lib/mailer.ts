import nodemailer from 'nodemailer'

export interface Mail {
  to: string
  subject: string
  text: string
  html: string
  /** Where replies go, e.g. the person who filled in a pilot request. */
  replyTo?: string
}

export interface Mailer {
  /** 'smtp' delivers real email; 'outbox' keeps messages in memory (and the log) for local development. */
  readonly kind: 'smtp' | 'outbox'
  send(mail: Mail): Promise<void>
}

export interface Outbox extends Mailer {
  readonly kind: 'outbox'
  /** Newest first. */
  list(): (Mail & { sentAt: number })[]
}

/** Real delivery through any SMTP provider, e.g. `smtps://user:app-password@smtp.gmail.com:465`. */
export function smtpMailer(url: string, from: string): Mailer {
  const transport = nodemailer.createTransport(url)
  return {
    kind: 'smtp',
    async send(mail) {
      await transport.sendMail({ from, ...mail })
    },
  }
}

/** Development stand-in: nothing leaves the machine. Messages show up at /api/dev/outbox and in the server log. */
export function outboxMailer({ log = true }: { log?: boolean } = {}): Outbox {
  const sent: (Mail & { sentAt: number })[] = []
  return {
    kind: 'outbox',
    async send(mail) {
      sent.unshift({ ...mail, sentAt: Date.now() })
      sent.length = Math.min(sent.length, 50)
      if (log) {
        const link = mail.text.match(/https?:\/\/\S+/)?.[0]
        console.log(`[mail] to ${mail.to}: ${mail.subject}${link ? `\n       ${link}` : ''}`)
      }
    },
    list: () => sent,
  }
}
