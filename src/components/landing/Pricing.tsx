import { motion } from 'motion/react'
import { ArrowRight, Building2, Check, CircleCheck, Landmark, User } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { api, errorMessage } from '../../lib/api'
import { Field } from '../ui/bits'
import { Button, ButtonLink } from '../ui/Button'
import { Modal } from '../ui/Modal'

type Paid = 'pool' | 'city'

interface Plan {
  id: 'instructor' | Paid
  icon: ReactNode
  name: string
  price: ReactNode
  blurb: string
  badge?: string
  /** [text, planned?] Planned items are shown as such; everything else exists today. */
  items: [string, boolean?][]
}

/**
 * Proposed pricing. The instructor plan is the app as it is today. The paid plans add services (setup, imports,
 * support, a dedicated server) and list features that don't exist yet as "Planned".
 */
const PLANS: Plan[] = [
  {
    id: 'instructor',
    icon: <User size={18} />,
    name: 'Instructor',
    price: 'Free',
    blurb: 'For one instructor’s classes, on every device they use.',
    items: [
      ['Every feature in the app'],
      ['Up to 5,000 classes and swimmers'],
      ['Report cards drafted from the skills, printed on letter paper'],
      ['Works offline and syncs across your devices'],
      ['Two-factor sign-in and device management'],
    ],
  },
  {
    id: 'pool',
    icon: <Building2 size={18} />,
    name: 'Pool',
    price: (
      <>
        CA$49
        <span className="text-[15px] font-medium text-muted"> /pool /month</span>
      </>
    ),
    blurb: 'For a facility’s whole instructor team.',
    badge: 'First session free',
    items: [
      ['Everything in Instructor, for all your staff'],
      ['A setup call and staff walkthrough before the session'],
      ['Class lists loaded in for you each session'],
      ['Priority email support'],
      ['Supervisor overview and rankings for every class'],
    ],
  },
  {
    id: 'city',
    icon: <Landmark size={18} />,
    name: 'City',
    price: 'Custom',
    blurb: 'For aquatics departments running several pools.',
    items: [
      ['Everything in Pool, at every pool'],
      ['Your own Lanemark server and database, hosted where you choose'],
      ['Your web address, with sign-in emails from your domain'],
      ['Volume pricing across pools'],
      ['Single sign-on with staff accounts', true],
    ],
  },
]

export function Pricing({ signedIn, heading }: { signedIn: boolean; heading: ReactNode }) {
  const [asking, setAsking] = useState<Paid | null>(null)
  // A new key per opening gives the form fresh state; closing keeps it mounted so the sheet can animate away.
  const [opened, setOpened] = useState(0)
  return (
    <section id="pricing" className="mx-auto max-w-6xl scroll-mt-24 px-4 pt-36">
      {heading}
      <div className="mt-14 grid items-stretch gap-4 lg:grid-cols-3">
        {PLANS.map((p, i) => {
          const featured = p.id === 'pool'
          return (
            <motion.article
              key={p.id}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{
                duration: 0.6,
                delay: i * 0.08,
                ease: [0.16, 1, 0.3, 1],
              }}
              className={`relative flex flex-col rounded-[1.75rem] p-7 ${featured ? 'plan-featured' : 'card'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2.5 text-[15px] font-semibold">
                  <span className={`flex size-8 items-center justify-center rounded-lg ${featured ? 'bg-aqua/15 text-aqua' : 'bg-fg/[0.06] text-muted'}`}>{p.icon}</span>
                  {p.name}
                </span>
                {p.badge && <span className="rounded-full bg-aqua/15 px-2.5 py-1 text-[11.5px] font-semibold text-aqua">{p.badge}</span>}
              </div>
              <div className="mt-6 font-display text-[2.4rem] font-extrabold leading-none tracking-[-0.03em]">{p.price}</div>
              <p className="mt-3 text-[14px] leading-relaxed text-muted">{p.blurb}</p>
              <ul className="mt-6 flex-1 space-y-3 border-t border-line pt-6">
                {p.items.map(([text, planned]) => (
                  <li key={text} className="flex gap-2.5 text-[14px] leading-snug">
                    <Check size={16} className={`mt-0.5 shrink-0 ${planned ? 'text-dim' : 'text-aqua'}`} strokeWidth={2.5} />
                    <span className={planned ? 'text-muted' : ''}>
                      {text}
                      {planned && (
                        <span className="ml-2 whitespace-nowrap rounded-md border border-line-2 px-1.5 py-px align-[1px] text-[10.5px] font-semibold uppercase tracking-wide text-dim">
                          Planned
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                {p.id === 'instructor' ? (
                  <ButtonLink to={signedIn ? '/app' : '/signup'} variant="outline" size="lg" className="w-full">
                    {signedIn ? 'Open Lanemark' : 'Create a free account'}
                  </ButtonLink>
                ) : (
                  <Button
                    variant={featured ? 'primary' : 'outline'}
                    size="lg"
                    className="w-full"
                    onClick={() => {
                      setOpened((n) => n + 1)
                      setAsking(p.id as Paid)
                    }}
                  >
                    Request a pilot <ArrowRight size={16} />
                  </Button>
                )}
              </div>
            </motion.article>
          )
        })}
      </div>
      <p className="mt-6 text-center text-[13px] text-dim">Prices in Canadian dollars, before tax. Instructor accounts are free.</p>
      <PilotDialog key={opened} plan={asking} onClose={() => setAsking(null)} />
    </section>
  )
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** "Request a pilot": emailed to the Lanemark team by the server, never saved in the app. */
function PilotDialog({ plan, onClose }: { plan: Paid | null; onClose: () => void }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    organisation: '',
    pools: '',
    message: '',
    website: '',
  })
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  useEffect(() => {
    if (!plan) return
    api<{ enabled: boolean }>('/contact')
      .then((r) => setEnabled(r.enabled))
      .catch(() => setEnabled(true))
  }, [plan])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!plan) return
    setState('busy')
    setError(null)
    try {
      await api('/contact', 'POST', {
        name: form.name,
        email: form.email,
        organisation: form.organisation,
        plan,
        pools: form.pools ? Number(form.pools) : undefined,
        message: form.message,
        website: form.website || undefined,
      })
      setState('sent')
    } catch (err) {
      setError(errorMessage(err))
      setState('idle')
    }
  }

  const ready = form.name.trim() && EMAIL.test(form.email.trim())
  return (
    <Modal
      open={plan !== null}
      onClose={onClose}
      title={state === 'sent' ? 'Request sent' : `Request a ${plan === 'city' ? 'City' : 'Pool'} pilot`}
      description={state === 'sent' ? undefined : 'Tell us a little about your pool and we’ll reply by email to set up a free first session.'}
    >
      {state === 'sent' ? (
        <div className="pb-1">
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="card flex items-start gap-3.5 p-5">
            <span className="icon-tile size-10 shrink-0 !rounded-xl !shadow-none">
              <CircleCheck size={18} />
            </span>
            <p className="text-[14px] leading-relaxed text-muted">
              Thanks, {form.name.trim().split(/\s+/)[0]}. We’ll reply to <b className="font-semibold text-fg">{form.email.trim()}</b>.
            </p>
          </motion.div>
          <Button className="mt-5 w-full" size="lg" onClick={onClose}>
            Done
          </Button>
        </div>
      ) : enabled === false ? (
        <p className="pb-1 text-[14px] leading-relaxed text-muted">Pilot requests aren’t switched on for this server yet.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4 pb-1" noValidate>
          {error && (
            <p role="alert" className="rounded-xl border border-bad/30 bg-bad/10 px-3.5 py-2.5 text-[13.5px] text-bad">
              {error}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name">
              <input className="input h-11" autoComplete="name" value={form.name} onChange={set('name')} maxLength={80} required autoFocus />
            </Field>
            <Field label="Work email">
              <input className="input h-11" type="email" autoComplete="email" inputMode="email" value={form.email} onChange={set('email')} maxLength={254} required />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
            <Field label="Facility or department">
              <input className="input h-11" autoComplete="organization" value={form.organisation} onChange={set('organisation')} maxLength={120} />
            </Field>
            <Field label="Pools">
              <input
                className="input h-11"
                type="number"
                inputMode="numeric"
                min={1}
                max={99}
                value={form.pools}
                onChange={set('pools')}
                placeholder={plan === 'city' ? '6' : '1'}
              />
            </Field>
          </div>
          <Field label="Anything we should know? (optional)">
            <textarea className="input min-h-24 py-2.5" value={form.message} onChange={set('message')} maxLength={2000} />
          </Field>
          {/* Hidden from people; bots fill it in and their request is dropped. */}
          <input tabIndex={-1} autoComplete="off" aria-hidden className="sr-only" value={form.website} onChange={set('website')} name="website" />
          <p className="text-[12.5px] leading-relaxed text-dim">This is emailed to the Lanemark team so we can reply. It isn’t saved in the app.</p>
          <Button variant="primary" size="lg" type="submit" className="w-full" loading={state === 'busy'} disabled={!ready}>
            Send request
          </Button>
        </form>
      )}
    </Modal>
  )
}
