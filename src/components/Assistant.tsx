import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, ArrowUp, RotateCcw, Sparkles, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { nextActions } from '../lib/actions'
import { isoDate } from '../lib/dates'
import { api, errorMessage } from '../lib/api'
import { isReportDone } from '../lib/reportRules'
import { skillProgress } from '../lib/stats'
import { useAssistant } from '../store/useAssistant'
import { useStore } from '../store/useStore'
import { openDialog, setPaletteOpen } from '../store/useUi'

interface Action {
  kind: 'navigate' | 'command'
  label: string
  target: string
}
interface Message {
  role: 'user' | 'assistant'
  content: string
  actions?: Action[]
  error?: boolean
}

const STORE_KEY = 'lanemark:assistant'
const SUGGESTIONS = ['What should I do today?', 'How do I write report cards?', 'What are the Swimmer 4 skills?', 'How do I turn on two-factor?']

const setOpen = (open: boolean) => useAssistant.setState({ open })

/** Class summaries for the assistant: names, levels and counts only. Never swimmer names or records. */
function buildContext(path: string) {
  const { classes } = useStore.getState()
  const today = isoDate()
  const active = classes.filter((c) => !c.archived)
  return {
    path,
    today,
    classes: active.slice(0, 60).map((c) => {
      const todayIdx = c.lessons.findIndex((l) => l.date === today)
      const next = c.lessons.find((l) => l.date > today)?.date ?? null
      return {
        id: c.id,
        name: c.name.slice(0, 120),
        levelId: c.levelId,
        lessons: c.lessons.length,
        taught: c.lessons.filter((l) => c.enrollments.some((e) => e.attendance[l.id])).length,
        swimmers: c.enrollments.length,
        reportsDone: c.enrollments.filter((e) => isReportDone(e, c.skills)).length,
        unassessed: c.enrollments.reduce((n, e) => n + skillProgress(e, c.skills).unmarked, 0),
        todayLesson: todayIdx === -1 ? null : todayIdx + 1,
        nextLessonDate: next,
      }
    }),
    todos: nextActions(active, today)
      .slice(0, 12)
      .map((a) => `${a.title} · ${a.className} (${a.detail})`.slice(0, 200)),
  }
}

export function Assistant() {
  const enabled = useAssistant((s) => s.enabled)
  const open = useAssistant((s) => s.open)
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(STORE_KEY) ?? '[]') as Message[]
    } catch {
      return []
    }
  })
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const navigate = useNavigate()
  const { pathname, search } = useLocation()

  useEffect(() => {
    if (useAssistant.getState().enabled !== null) return
    api<{ enabled: boolean }>('/assistant')
      .then((r) => useAssistant.setState({ enabled: r.enabled }))
      .catch(() => useAssistant.setState({ enabled: false }))
  }, [])

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(messages.slice(-30)))
    } catch {
      /* private mode */
    }
  }, [messages])

  useLayoutEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy, open])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => inputRef.current?.focus(), 150)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!enabled) return null

  async function send(text: string) {
    const content = text.trim()
    if (!content || busy) return
    const history = [...messages.filter((m) => !m.error), { role: 'user' as const, content }]
    setMessages(history)
    setInput('')
    setBusy(true)
    try {
      const res = await api<{ reply: string; actions: Action[] }>('/assistant', 'POST', {
        messages: history.slice(-12).map(({ role, content: c }) => ({ role, content: c.slice(0, 2000) })),
        context: buildContext(pathname + search),
      })
      setMessages((m) => [...m, { role: 'assistant', content: res.reply, actions: res.actions }])
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: navigator.onLine ? errorMessage(err) : 'You’re offline. The assistant needs a connection; everything else keeps working.', error: true }])
    } finally {
      setBusy(false)
    }
  }

  function run(a: Action) {
    if (window.innerWidth < 640) setOpen(false)
    if (a.kind === 'navigate') navigate(a.target)
    else if (a.target === 'new-class') openDialog('newClass')
    else if (a.target === 'new-swimmer') openDialog('newSwimmer')
    else if (a.target === 'search') setPaletteOpen(true)
    else if (a.target === 'shortcuts') {
      setOpen(false)
      setTimeout(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' })), 50)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    void send(input)
  }

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.8, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 8 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => setOpen(true)}
            aria-label="Ask the Lanemark assistant"
            // Phones open it from the top bar instead, so nothing floats over lists and buttons.
            className="no-print btn-primary fixed bottom-6 right-6 z-40 hidden h-11 items-center justify-center gap-2 rounded-full px-4 md:flex"
            style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
          >
            <Sparkles size={17} />
            <span className="text-[14px]">Ask</span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.section
            role="dialog"
            aria-label="Lanemark assistant"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="no-print pill-nav fixed inset-x-2 bottom-2 top-16 z-50 flex origin-bottom-right flex-col overflow-hidden rounded-[1.75rem] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:top-auto sm:h-[min(640px,calc(100dvh/var(--ui-zoom,1)-7rem))] sm:w-[400px]"
            style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
          >
            <header className="flex items-center gap-3 border-b border-line px-4 py-3">
              <span className="icon-tile size-9 !rounded-xl !shadow-none">
                <Sparkles size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-[15px] font-bold leading-tight">Ask Lanemark</h2>
                <p className="text-[12px] text-dim">Directions, curriculum and how-tos</p>
              </div>
              {messages.length > 0 && (
                <button type="button" onClick={() => setMessages([])} aria-label="Start over" title="Start over" className="inline-flex size-9 items-center justify-center rounded-full text-dim hover:bg-fg/[0.07] hover:text-fg">
                  <RotateCcw size={15} />
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant" className="inline-flex size-9 items-center justify-center rounded-full text-dim hover:bg-fg/[0.07] hover:text-fg">
                <X size={17} />
              </button>
            </header>

            <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
              {messages.length === 0 && (
                <div className="pt-2">
                  <p className="font-display text-[1.35rem] font-bold leading-tight tracking-tight">
                    Hi! What do you <span className="accent">need?</span>
                  </p>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-muted">I can find a page, explain a feature, or look up any level’s skills and must-sees.</p>
                  <div className="mt-5 flex flex-col items-start gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} type="button" onClick={() => void send(s)} className="rounded-full border border-line-2 px-3.5 py-2 text-left text-[13.5px] text-muted transition-colors hover:border-aqua/50 hover:text-fg">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={m.role === 'user' ? 'flex justify-end' : ''}>
                  {m.role === 'user' ? (
                    <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-fg px-3.5 py-2 text-[14px] leading-relaxed text-ink">{m.content}</p>
                  ) : (
                    <div className={`max-w-[92%] text-[14px] leading-relaxed ${m.error ? 'text-warn' : ''}`}>
                      <Rich text={m.content} />
                      {m.actions && m.actions.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-2">
                          {m.actions.map((a) => (
                            <button key={a.target + a.label} type="button" onClick={() => run(a)} className="btn-glass inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold">
                              {a.label} <ArrowRight size={13} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
              {busy && (
                <div className="flex gap-1 py-1" aria-label="Thinking">
                  {[0, 1, 2].map((i) => (
                    <motion.span key={i} className="size-2 rounded-full bg-aqua" animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={submit} className="border-t border-line p-3">
              <div className="flex items-end gap-2 rounded-2xl border border-line-2 bg-panel/70 p-1.5 pl-3.5 focus-within:border-aqua/60">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void send(input)
                    }
                  }}
                  maxLength={2000}
                  placeholder="Ask anything about Lanemark…"
                  aria-label="Message the assistant"
                  className="max-h-32 min-h-9 flex-1 resize-none bg-transparent py-2 text-[14px] outline-none placeholder:text-dim"
                />
                <button type="submit" disabled={!input.trim() || busy} aria-label="Send" className="btn-primary inline-flex size-9 shrink-0 items-center justify-center rounded-full disabled:opacity-40">
                  <ArrowUp size={16} />
                </button>
              </div>
              <p className="mt-2 px-1 text-[11.5px] leading-snug text-dim">AI answers can be wrong. It never sees swimmer names; please don’t type personal details.</p>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  )
}

/** Tiny, safe formatter for replies: paragraphs, "- " lists and **bold**. No HTML is injected. */
function Rich({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  let list: string[] = []
  const flush = () => {
    if (list.length) blocks.push(<ul key={blocks.length} className="my-1.5 list-disc space-y-1 pl-5">{list.map((l, i) => <li key={i}>{bold(l)}</li>)}</ul>)
    list = []
  }
  for (const line of text.split('\n')) {
    const item = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)$/)
    if (item) list.push(item[1])
    else {
      flush()
      if (line.trim()) blocks.push(<p key={blocks.length} className="mt-1.5 first:mt-0">{bold(line)}</p>)
    }
  }
  flush()
  return <>{blocks}</>
}

function bold(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith('**') && part.endsWith('**') ? <strong key={i} className="font-semibold text-fg">{part.slice(2, -2)}</strong> : part))
}
