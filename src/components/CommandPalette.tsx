import { Command } from 'cmdk'
import { AnimatePresence, motion } from 'motion/react'
import { BookOpen, Building2, CalendarCheck, CornerDownLeft, LayoutGrid, ListChecks, LogOut, Moon, Plus, Search, Settings, Sun, UserPlus, Users } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { LEVELS, getLevel } from '../data/curriculum'
import { paletteFilter } from '../lib/paletteFilter'
import { signOut } from '../lib/signout'
import { toggleTheme, useTheme } from '../lib/theme'
import { useSession } from '../store/useSession'
import { useStore } from '../store/useStore'
import { openDialog, setPaletteOpen, toast, useUi } from '../store/useUi'
import { Avatar } from './ui/Avatar'
import { Kbd, LevelChip } from './ui/bits'

export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen)
  return <AnimatePresence>{open && <PaletteBody />}</AnimatePresence>
}

function PaletteBody() {
  const classes = useStore((s) => s.classes)
  const swimmers = useStore((s) => s.swimmers)
  const theme = useTheme((s) => s.resolved)
  const status = useSession((s) => s.status)
  const navigate = useNavigate()
  const [q, setQ] = useState('')

  const skills = useMemo(
    () => (q.trim().length < 2 ? [] : LEVELS.flatMap((l) => l.skills.map((s) => ({ level: l, skill: s })))),
    [q],
  )

  const go = (to: string) => {
    setPaletteOpen(false)
    navigate(to)
  }
  const run = (fn: () => void) => {
    setPaletteOpen(false)
    fn()
  }

  return (
        <div className="fixed inset-0 z-[60] flex items-start justify-center px-3 pt-[12vh]" role="presentation">
          <motion.div
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPaletteOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10, filter: 'blur(6px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.97, y: -6 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-line-2 bg-panel/95 shadow-[var(--shadow-lg)] backdrop-blur-2xl"
          >
            <Command
              label="Command menu"
              loop
              filter={paletteFilter}
              onKeyDown={(e) => e.key === 'Escape' && setPaletteOpen(false)}
              className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-dim"
            >
              <div className="flex items-center gap-3 border-b border-line px-4">
                <Search size={17} className="shrink-0 text-dim" />
                <Command.Input
                  autoFocus
                  value={q}
                  onValueChange={setQ}
                  placeholder="Search classes, swimmers, skills, actions…"
                  className="h-14 w-full bg-transparent text-[15px] text-fg outline-none placeholder:text-dim"
                />
                <Kbd>Esc</Kbd>
              </div>
              <Command.List className="max-h-[min(60vh,440px)] overflow-y-auto overscroll-contain p-1.5">
                <Command.Empty className="px-4 py-10 text-center text-sm text-muted">No results for “{q}”.</Command.Empty>

                <Command.Group heading="Actions">
                  <Item icon={<Plus size={16} />} onSelect={() => openDialog('newClass')} keywords={['create', 'add']}>
                    New class
                  </Item>
                  <Item icon={<UserPlus size={16} />} onSelect={() => openDialog('newSwimmer')} keywords={['create', 'add', 'student', 'kid']}>
                    New swimmer
                  </Item>
                  <Item icon={theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />} onSelect={() => run(() => toggleTheme())} keywords={['theme', 'dark', 'light']}>
                    Switch to {theme === 'dark' ? 'light' : 'dark'} mode
                  </Item>
                </Command.Group>

                {classes.length > 0 && (
                  <Command.Group heading="Classes">
                    {classes.map((c) => {
                      const level = getLevel(c.levelId)
                      return (
                        <Command.Item key={c.id} value={`class ${c.name} ${c.session} ${level?.name ?? ''}`} onSelect={() => go(`/app/classes/${c.id}`)} className={ITEM}>
                          <LayoutGrid size={16} className="text-dim" />
                          <span className="flex-1 truncate">{c.name}</span>
                          <LevelChip level={level} />
                        </Command.Item>
                      )
                    })}
                    {classes.slice(0, 6).map((c) => (
                      <Command.Item key={`att-${c.id}`} value={`attendance take ${c.name}`} onSelect={() => go(`/app/classes/${c.id}?tab=attendance`)} className={ITEM}>
                        <CalendarCheck size={16} className="text-dim" />
                        <span className="flex-1 truncate">Take attendance · {c.name}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {swimmers.length > 0 && (
                  <Command.Group heading="Swimmers">
                    {swimmers.map((w) => (
                      <Command.Item key={w.id} value={`swimmer ${w.name} ${w.notes}`} onSelect={() => go(`/app/swimmers/${w.id}`)} className={ITEM}>
                        <Avatar name={w.name} photo={w.photo} size={22} />
                        <span className="flex-1 truncate">{w.name}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                <Command.Group heading="Go to">
                  <Item icon={<LayoutGrid size={16} />} onSelect={() => go('/app')}>
                    Classes
                  </Item>
                  <Item icon={<Users size={16} />} onSelect={() => go('/app/swimmers')}>
                    Swimmers
                  </Item>
                  <Item icon={<BookOpen size={16} />} onSelect={() => go('/app/curriculum')}>
                    Curriculum
                  </Item>
                  <Item icon={<Building2 size={16} />} onSelect={() => go('/app/pool')} keywords={['supervisor', 'team', 'join', 'invite', 'code', 'rankings', 'leaderboard']}>
                    Pool
                  </Item>
                  <Item icon={<Settings size={16} />} onSelect={() => go('/app/settings')} keywords={['account', 'security', '2fa', 'password', 'export', 'backup']}>
                    Settings
                  </Item>
                  {status !== 'demo' && (
                    <Item icon={<LogOut size={16} />} onSelect={() => run(() => void signOut(navigate).then((d) => d && toast('Signed out')))} keywords={['logout', 'log out']}>
                      Sign out
                    </Item>
                  )}
                </Command.Group>

                {skills.length > 0 && (
                  <Command.Group heading="Curriculum skills">
                    {skills.map(({ level, skill }) => (
                      <Command.Item
                        key={skill.id}
                        value={`skill ${skill.name} ${level.name} ${level.short}`}
                        onSelect={() => go(`/app/curriculum?q=${encodeURIComponent(skill.name)}`)}
                        className={ITEM}
                      >
                        <ListChecks size={16} className="text-dim" />
                        <span className="flex-1 truncate">{skill.name}</span>
                        <LevelChip level={level} />
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </Command.List>
              <div className="flex items-center gap-3 border-t border-line px-4 py-2.5 text-[11px] text-dim">
                <span className="flex items-center gap-1">
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd> navigate
                </span>
                <span className="flex items-center gap-1">
                  <Kbd>
                    <CornerDownLeft size={10} />
                  </Kbd>
                  open
                </span>
              </div>
            </Command>
          </motion.div>
        </div>
  )
}

const ITEM =
  'flex cursor-pointer select-none items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] text-fg outline-none transition-colors data-[selected=true]:bg-fg/[0.07] data-[selected=true]:[&>svg]:text-aqua'

function Item({ icon, children, onSelect, keywords }: { icon: ReactNode; children: ReactNode; onSelect: () => void; keywords?: string[] }) {
  return (
    <Command.Item onSelect={onSelect} keywords={keywords} className={ITEM}>
      <span className="text-dim">{icon}</span>
      <span className="flex-1">{children}</span>
    </Command.Item>
  )
}
