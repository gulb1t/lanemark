import type { Mail } from './mailer.ts'

/**
 * Transactional emails. Table layout and inline styles, because that's what mail clients render reliably.
 * Every message has a plain-text part with the same content.
 */

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!)

interface Parts {
  to: string
  subject: string
  preview: string
  heading: string
  paragraphs: string[]
  action?: { label: string; url: string }
  footnote: string
}

function render({ to, subject, preview, heading, paragraphs, action, footnote }: Parts): Mail {
  // The app icon, from the same site the email links to. Mail clients don't show SVG, so it's the PNG; emails
  // without a link get a plain tile in the logo's colours instead.
  const logo = action
    ? `<img src="${esc(new URL(action.url).origin)}/icon-192.png" width="26" height="26" alt="" style="display:inline-block;border-radius:7px;vertical-align:middle;margin-right:8px">`
    : '<span style="display:inline-block;width:26px;height:26px;border-radius:7px;background:#0f1a2b;vertical-align:middle;margin-right:8px"></span>'

  const button = action
    ? `<tr><td style="padding:8px 0 24px"><a href="${esc(action.url)}" style="display:inline-block;background:#0a1020;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 26px;border-radius:999px">${esc(action.label)}</a></td></tr>
       <tr><td style="font-size:13px;line-height:1.6;color:#667085;padding-bottom:24px">Or paste this link into your browser:<br><a href="${esc(action.url)}" style="color:#2657e0;word-break:break-all">${esc(action.url)}</a></td></tr>`
    : ''
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body style="margin:0;background:#f2f5f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0a1020">
<span style="display:none;max-height:0;overflow:hidden">${esc(preview)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f5f8;padding:32px 12px">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
    <tr><td style="padding:0 4px 18px;font-size:17px;font-weight:700;letter-spacing:-0.01em">
      ${logo}SwimTrack
    </td></tr>
    <tr><td style="background:#ffffff;border:1px solid #e4e8ee;border-radius:20px;padding:32px 32px 8px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="font-size:22px;font-weight:700;letter-spacing:-0.02em;padding-bottom:14px">${esc(heading)}</td></tr>
        ${paragraphs.map((p) => `<tr><td style="font-size:15px;line-height:1.6;color:#344054;padding-bottom:16px">${esc(p)}</td></tr>`).join('')}
        ${button}
      </table>
    </td></tr>
    <tr><td style="font-size:12px;line-height:1.6;color:#667085;padding:18px 8px">${esc(footnote)}</td></tr>
  </table>
</td></tr>
</table>
</body></html>`
  const text = [heading, '', ...paragraphs.flatMap((p) => [p, '']), ...(action ? [`${action.label}: ${action.url}`, ''] : []), footnote].join('\n')
  return { to, subject, text, html }
}

const IGNORE = 'If you didn’t ask for this, you can ignore this email. Nothing changes until the link is used.'

export const emails = {
  verify: (to: string, name: string, url: string) =>
    render({
      to,
      subject: 'Confirm your email for SwimTrack',
      preview: 'One tap to confirm your address.',
      heading: `Welcome, ${name.split(/\s+/)[0]}`,
      paragraphs: ['Confirm this is your email so you can reset your password and get security alerts about your account. The link works for 24 hours.'],
      action: { label: 'Confirm email', url },
      footnote: IGNORE,
    }),

  changeEmail: (to: string, url: string) =>
    render({
      to,
      subject: 'Confirm your new SwimTrack email',
      preview: 'Confirm the new address for your account.',
      heading: 'Confirm your new email',
      paragraphs: ['Someone asked to move a SwimTrack account to this address. Confirm it to finish the change. The link works for 24 hours.'],
      action: { label: 'Confirm new email', url },
      footnote: IGNORE,
    }),

  reset: (to: string, url: string) =>
    render({
      to,
      subject: 'Reset your SwimTrack password',
      preview: 'This link works for 30 minutes.',
      heading: 'Reset your password',
      paragraphs: ['We got a request to reset the password for this SwimTrack account. The link works once, for 30 minutes. If two-factor authentication is on, you’ll still need your authenticator app to sign in.'],
      action: { label: 'Choose a new password', url },
      footnote: 'If you didn’t ask for this, you can ignore this email. Your password stays the same.',
    }),

  contact: (to: string, r: { name: string; email: string; organisation: string; plan: 'pool' | 'city'; pools?: number; message: string }) => {
    const plan = r.plan === 'city' ? 'City' : 'Pool'
    const mail = render({
      to,
      subject: `Pilot request (${plan}): ${r.organisation || r.name}`,
      preview: `${r.name} asked about the ${plan} plan.`,
      heading: `${plan} plan pilot request`,
      paragraphs: [
        `From: ${r.name} <${r.email}>`,
        `Organisation: ${r.organisation || 'not given'}`,
        ...(r.pools ? [`Pools: ${r.pools}`] : []),
        r.message ? `Message: ${r.message}` : 'No message.',
      ],
      footnote: 'Sent from the pricing section on SwimTrack. Reply to this email to answer them directly.',
    })
    return { ...mail, replyTo: r.email }
  },

  notice: (to: string, subject: string, heading: string, body: string, resetUrl: string) =>
    render({
      to,
      subject,
      preview: body,
      heading,
      paragraphs: [body, 'If this wasn’t you, reset your password now. Resetting signs every device out, then review Settings → Security.'],
      action: { label: 'Reset my password', url: resetUrl },
      footnote: 'You’re getting this because it’s a security change to your SwimTrack account.',
    }),
}
