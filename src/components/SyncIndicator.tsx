import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, Check, CloudOff, HardDrive, Loader2 } from 'lucide-react'
import { timeAgo, useNow } from '../lib/hooks'
import { syncNow, useSync } from '../sync/engine'

/** Small pill that shows whether edits are saved to the cloud, in flight, or waiting for a connection. */
export function SyncIndicator({ compact = false }: { compact?: boolean }) {
  const { status, pending, lastSyncedAt, error } = useSync()
  const now = useNow(20_000)

  const view = {
    synced: { icon: <Check size={13} strokeWidth={2.75} />, label: 'Saved', tone: 'text-good', tip: lastSyncedAt ? `Synced ${timeAgo(lastSyncedAt, now)}` : 'All changes saved' },
    saving: { icon: <Loader2 size={13} className="animate-spin" />, label: 'Saving', tone: 'text-aqua', tip: `Saving ${pending} change${pending === 1 ? '' : 's'}…` },
    offline: {
      icon: <CloudOff size={13} />,
      label: pending ? `Offline · ${pending}` : 'Offline',
      tone: 'text-warn',
      tip: pending ? `${pending} change${pending === 1 ? '' : 's'} saved on this device. They sync when you’re back online.` : 'You’re offline. Edits are saved on this device.',
    },
    error: { icon: <AlertTriangle size={13} />, label: 'Sync issue', tone: 'text-bad', tip: error ?? 'Couldn’t sync. Retrying.' },
    local: { icon: <HardDrive size={13} />, label: 'Demo', tone: 'text-muted', tip: 'Demo data stays in this browser.' },
  }[status]

  return (
    <button
      type="button"
      onClick={() => void syncNow()}
      title={view.tip}
      aria-label={`${view.label}. ${view.tip}`}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-fg/[0.03] px-2.5 font-mono text-[11px] font-medium transition-colors hover:bg-fg/[0.07] ${view.tone}`}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={status}
          initial={{ opacity: 0, scale: 0.4, rotate: -90 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          exit={{ opacity: 0, scale: 0.4 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="flex"
        >
          {view.icon}
        </motion.span>
      </AnimatePresence>
      {!compact && <span className="tracking-wide">{view.label}</span>}
    </button>
  )
}
