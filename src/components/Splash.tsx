import { motion } from 'motion/react'
import { Logo } from './Logo'

/** Full-screen loading state while the session and route chunks load. */
export function Splash() {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink" role="status" aria-label="Loading Lanemark">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15, duration: 0.4 }} className="flex flex-col items-center gap-4">
        <Logo size={44} animated />
        <div className="h-0.5 w-24 overflow-hidden rounded-full bg-fg/10">
          <motion.div
            className="h-full w-1/2 rounded-full bg-aqua"
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </motion.div>
    </div>
  )
}
