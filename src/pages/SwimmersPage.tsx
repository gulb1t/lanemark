import { motion } from 'motion/react'
import { Plus, Search, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '../components/ui/Avatar'
import { Button } from '../components/ui/Button'
import { EmptyState, LevelChip, Segmented } from '../components/ui/bits'
import { getLevel } from '../data/curriculum'
import { useStore } from '../store/useStore'
import { openDialog } from '../store/useUi'

export default function SwimmersPage() {
  const swimmers = useStore((s) => s.swimmers)
  const classes = useStore((s) => s.classes)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<'name' | 'recent'>('name')

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return swimmers
      .filter((w) => !needle || w.name.toLowerCase().includes(needle) || w.notes.toLowerCase().includes(needle))
      .sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : b.createdAt - a.createdAt))
      .map((w) => ({ w, in: classes.filter((c) => !c.archived && c.enrollments.some((e) => e.swimmerId === w.id)) }))
  }, [swimmers, classes, q, sort])

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow mb-2">Everyone you teach</div>
          <h1 className="page-title">Swimmers</h1>
        </div>
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => openDialog('newSwimmer')}>
          New swimmer
        </Button>
      </section>

      {swimmers.length === 0 ? (
        <EmptyState
          icon={<Users size={22} />}
          title="No swimmers yet"
          body="Add swimmers here or straight from a class roster. A swimmer can be in several classes and keeps their photo and notes everywhere."
          action={
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => openDialog('newSwimmer')}>
              New swimmer
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-60 flex-1 sm:max-w-sm">
              <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-dim" />
              <input className="input h-10 pl-10" placeholder={`Search ${swimmers.length} swimmers`} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search swimmers" />
            </div>
            <Segmented size="sm" label="Sort" value={sort} onChange={setSort} options={[{ value: 'name', label: 'A–Z' }, { value: 'recent', label: 'Newest' }]} />
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map(({ w, in: inClasses }, i) => (
              <motion.li key={w.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.025 }}>
                <Link to={`/app/swimmers/${w.id}`} className="card spotlight flex h-full items-start gap-3.5 p-4 transition-transform active:scale-[0.99]">
                  <Avatar name={w.name} photo={w.photo} size={52} />
                  <div className="relative min-w-0 flex-1">
                    <h3 className="truncate text-[15px] font-semibold">{w.name}</h3>
                    {w.notes && <p className="mt-0.5 line-clamp-1 text-[13px] text-muted">{w.notes}</p>}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {inClasses.length ? (
                        inClasses.slice(0, 3).map((c) => <LevelChip key={c.id} level={getLevel(c.levelId)} />)
                      ) : (
                        <span className="text-xs text-dim">Not in an active class</span>
                      )}
                    </div>
                  </div>
                </Link>
              </motion.li>
            ))}
            {!rows.length && <li className="col-span-full py-10 text-center text-sm text-muted">No swimmers match “{q}”.</li>}
          </ul>
        </>
      )}
    </div>
  )
}
