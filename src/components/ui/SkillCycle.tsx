import { Check } from 'lucide-react'
import { motion } from 'motion/react'
import type { SkillStatus } from '../../types'

/** Phones: one button per skill; each tap goes passed, then not yet, then back to unmarked. */
export function SkillCycle({ name, value, onChange }: { name: string; value: SkillStatus | undefined; onChange: (next: SkillStatus | undefined) => void }) {
  const next = value === undefined ? 'pass' : value === 'pass' ? 'incomplete' : undefined
  const label = value === 'pass' ? 'Passed' : value === 'incomplete' ? 'Not yet' : 'Mark'
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.9 }}
      onClick={() => onChange(next)}
      aria-label={`${name}: ${value === 'pass' ? 'passed' : value === 'incomplete' ? 'not yet' : 'not marked'}. Tap for ${next === 'pass' ? 'passed' : next === 'incomplete' ? 'not yet' : 'not marked'}.`}
      className={`inline-flex h-10 w-[6.25rem] shrink-0 items-center justify-center gap-1.5 rounded-full border text-[13.5px] font-semibold transition-colors ${
        value === 'pass' ? 'border-good bg-good text-ink' : value === 'incomplete' ? 'border-warn bg-warn text-ink' : 'border-dashed border-line-2 text-dim'
      }`}
    >
      {value === 'pass' && <Check size={15} strokeWidth={3} />}
      {label}
    </motion.button>
  )
}
