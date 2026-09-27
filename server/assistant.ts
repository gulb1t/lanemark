import { LEVEL_BY_ID, LEVELS, PROGRAMS } from '../src/data/curriculum.ts'
import type { Config } from './config.ts'

/**
 * The in-app assistant. It answers "how do I…" questions about SwimTrack and the Swim for Life curriculum, and
 * points people to the right screen with buttons. The model sees the user's question, the page they're on and a
 * summary of their classes (names, levels, counts). Never swimmer names, photos, notes or comments.
 */

export interface AssistantContext {
  path: string
  today?: string
  classes: {
    id: string
    name: string
    levelId: string
    lessons: number
    taught: number
    swimmers: number
    reportsDone: number
    unassessed: number
    todayLesson: number | null
    nextLessonDate: string | null
  }[]
  todos?: string[]
}

export interface AssistantAction {
  kind: 'navigate' | 'command'
  label: string
  /** Path for navigate, command name for command. */
  target: string
}

type Msg =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string }
type ToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } }

const COMMANDS = {
  'new-class': 'Opens the new class dialog',
  'new-swimmer': 'Opens the new swimmer dialog',
  search: 'Opens the search / jump-to palette',
  shortcuts: 'Shows the keyboard shortcuts',
} as const

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'navigate',
      description: 'Show the user a button that opens a page in SwimTrack. Use whenever a page would help. Only paths listed in the guide.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'App path, e.g. /app/curriculum?level=sw4' }, label: { type: 'string', description: 'Short button text, e.g. "Open Swimmer 4 skills"' } },
        required: ['path', 'label'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'command',
      description: 'Show a button that does something in the app.',
      parameters: {
        type: 'object',
        properties: { command: { type: 'string', enum: Object.keys(COMMANDS) }, label: { type: 'string' } },
        required: ['command', 'label'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_level',
      description: 'The skills (with distances) and report card must-sees for one Swim for Life level. Use before answering anything about a level’s skills.',
      parameters: { type: 'object', properties: { levelId: { type: 'string', enum: LEVELS.map((l) => l.id) } }, required: ['levelId'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_skill',
      description: 'Search every level for skills matching words, e.g. "front crawl 25" or "tread water".',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    },
  },
]

const LEVEL_LIST = LEVELS.map((l) => `${l.id} = ${l.name} (${PROGRAMS[l.program].label})`).join('; ')

function systemPrompt(ctx: AssistantContext) {
  const classes = ctx.classes.length
    ? ctx.classes
        .map(
          (c) =>
            `- "${c.name}" (id ${c.id}, level ${c.levelId}): ${c.swimmers} swimmers, lesson ${c.taught} of ${c.lessons} taught, ${c.reportsDone}/${c.swimmers} report cards done, ${c.unassessed} skills not assessed` +
            (c.todayLesson ? `, teaching lesson ${c.todayLesson} TODAY` : c.nextLessonDate ? `, next lesson ${c.nextLessonDate}` : ''),
        )
        .join('\n')
    : '(no classes yet)'
  return `You are the SwimTrack assistant, built into SwimTrack: an app swim instructors use on deck for attendance, skill check-offs, lesson plans and report cards, based on the Lifesaving Society's Swim for Life program and its report card guidelines.

Style: friendly, brief, practical. 1–4 short sentences or a short list. Plain words, no jargon. Use **bold** sparingly. Never invent features. If you don't know, say so.

Always offer a button with the navigate or command tool when a screen would help, then say one sentence about what to do there. Buttons beat typed paths: never write raw URLs in your text.
For "what should I do" questions: start with today's classes, then the to-do list (overdue attendance first), and give a button for each of the top two items.

Pages (the only valid navigate paths; substitute real ids):
- /app : dashboard. Today's classes with one-tap attendance, a to-do list, all classes.
- /app/classes/{classId} : a class. Tabs via ?tab=attendance | skills | lessons | reports | settings (roster is the default).
- /app/classes/{classId}?tab=attendance : take attendance (tap present/late/absent, "Rest present" marks everyone left).
- /app/classes/{classId}?tab=skills : check off skills (pass / incomplete). A swimmer passes a level only when every item is passed.
- /app/classes/{classId}?tab=lessons : lesson dates, topics and notes; change the number of lessons.
- /app/classes/{classId}?tab=reports : report cards for the class; print the whole class, or download a spreadsheet (CSV) of attendance, skills and comments.
- /app/classes/{classId}?tab=settings : rename, change level, archive or delete the class.
- /app/swimmers : every swimmer; /app/swimmers/{swimmerId} a swimmer's profile (you don't know swimmer ids; send people to /app/swimmers).
- /app/curriculum?level={levelId} : every level's skills, distances and must-sees. Use ?q=words to search.
- /app/settings?s={section} : settings. Sections: account (name, email, delete account), security (password, two-factor, trusted devices, reset link), devices (signed-in devices), data (backup, import, reset demo), appearance (light/dark).
- /privacy : what data is stored and where.

Commands: ${Object.entries(COMMANDS)
    .map(([k, v]) => `${k} (${v})`)
    .join('; ')}.

How things work:
- Report cards: open the class's Report cards tab, then "Continue writing" opens a workspace per swimmer: tick skills, tap "Great job with…" and "Work on…" chips (from the manual's must-sees) to build the comment, then print one card or the whole class on letter paper. Manual rules: comment on at least two items, never mention attendance or behaviour, only move a swimmer up when every item is passed. Keyboard: ←/→ switch swimmers.
- Offline: everything saves on the device first and syncs when back online.
- Two-factor: Settings → Security. Trusted devices can skip the code for 30 days.
- Forgot password: the sign-in page has "Forgot password?"; signed in, Settings → Security → "Email me a reset link".
- Demo mode keeps data in the browser only.

Levels (id = name): ${LEVEL_LIST}. "Swimmer 4" means the level sw4, not a person. Use get_level for skill questions instead of guessing.

The user is on ${ctx.path}. Today is ${ctx.today ?? 'unknown'}.
Their classes:
${classes}
${ctx.todos?.length ? `Their to-do list:\n${ctx.todos.map((t) => `- ${t}`).join('\n')}` : ''}

Privacy: you never see swimmer names or records. If asked about a specific swimmer, send them to the class or /app/swimmers. Tell people not to type swimmers' personal details here.`
}

function runTool(name: string, args: Record<string, unknown>, ctx: AssistantContext, actions: AssistantAction[]): string {
  if (name === 'navigate') {
    const path = String(args.path ?? '')
    const label = String(args.label ?? 'Open').slice(0, 60)
    if (!safePath(path, ctx)) return 'Rejected: that is not a valid SwimTrack page. Use a path from the guide with a real class id.'
    if (!actions.some((a) => a.target === path)) actions.push({ kind: 'navigate', label, target: path })
    return 'Button shown.'
  }
  if (name === 'command') {
    const command = String(args.command ?? '')
    if (!(command in COMMANDS)) return 'Unknown command.'
    actions.push({ kind: 'command', label: String(args.label ?? command).slice(0, 60), target: command })
    return 'Button shown.'
  }
  if (name === 'get_level') {
    const level = LEVEL_BY_ID[String(args.levelId ?? '')]
    if (!level) return 'No such level.'
    return JSON.stringify({
      id: level.id,
      name: level.name,
      ages: level.ages,
      minutes: level.minutes,
      next: level.next ? LEVEL_BY_ID[level.next]?.name : null,
      skills: level.skills.map((s) => ({ category: s.category, name: s.name, mustSees: s.mustSees })),
    })
  }
  if (name === 'find_skill') {
    const words = String(args.query ?? '')
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
    const hits = LEVELS.flatMap((l) => l.skills.filter((s) => words.every((w) => `${s.name} ${s.category}`.toLowerCase().includes(w))).map((s) => `${l.name} (${l.id}): ${s.name}`))
    return hits.length ? hits.slice(0, 25).join('\n') : 'No matching skills.'
  }
  return 'Unknown tool.'
}

/** Only in-app paths the guide lists, with class ids the user actually has. */
export function safePath(path: string, ctx: Pick<AssistantContext, 'classes'>): boolean {
  if (!/^\/[\w\-/?=&%.]*$/.test(path) || path.includes('//')) return false
  const [p] = path.split('?')
  if (['/app', '/app/swimmers', '/app/curriculum', '/app/settings', '/privacy'].includes(p)) return true
  const cls = p.match(/^\/app\/classes\/([\w.-]+)$/)
  return Boolean(cls && ctx.classes.some((c) => c.id === cls[1]))
}

export class AssistantError extends Error {}

export async function askAssistant(
  config: Config['ai'],
  history: { role: 'user' | 'assistant'; content: string }[],
  ctx: AssistantContext,
  fetchImpl: typeof fetch = fetch,
): Promise<{ reply: string; actions: AssistantAction[] }> {
  if (!config.key) throw new AssistantError('The assistant isn’t set up on this server.')
  const messages: Msg[] = [{ role: 'system', content: systemPrompt(ctx) }, ...history.slice(-12)]
  const actions: AssistantAction[] = []

  for (let round = 0; round < 4; round++) {
    const res = await fetchImpl(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.model, messages, tools: TOOLS, max_tokens: 700, temperature: 0.4 }),
      signal: AbortSignal.timeout(30_000),
    }).catch(() => null)
    if (!res?.ok) throw new AssistantError('The assistant is unavailable right now. Try again in a moment.')
    const data = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[] } | null
    const msg = data?.choices?.[0]?.message
    if (!msg) throw new AssistantError('The assistant sent back an empty answer. Try asking another way.')

    if (msg.tool_calls?.length) {
      messages.push({ role: 'assistant', content: msg.content ?? null, tool_calls: msg.tool_calls })
      for (const call of msg.tool_calls) {
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(call.function.arguments || '{}')
        } catch {
          /* bad JSON from the model */
        }
        messages.push({ role: 'tool', tool_call_id: call.id, content: runTool(call.function.name, args, ctx, actions) })
      }
      // Navigation-only turns that already said something don't need another round trip.
      if (msg.content?.trim() && msg.tool_calls.every((c) => c.function.name === 'navigate' || c.function.name === 'command')) {
        return { reply: msg.content.trim(), actions }
      }
      continue
    }
    const reply = (msg.content ?? '').trim()
    return { reply: reply || (actions.length ? 'Here you go:' : 'Sorry, I couldn’t work that out. Try asking another way.'), actions }
  }
  return { reply: actions.length ? 'Here you go:' : 'Sorry, that took too many steps. Try a simpler question.', actions }
}
