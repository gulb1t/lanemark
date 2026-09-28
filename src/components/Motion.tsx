import { MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'
import { useEffectsPref } from '../lib/effects'

/** Animations follow the system's reduced-motion setting, and are cut back entirely with lite effects. */
export function Motion({ children }: { children: ReactNode }) {
  const lite = useEffectsPref((s) => s.lite)
  return <MotionConfig reducedMotion={lite ? 'always' : 'user'}>{children}</MotionConfig>
}
