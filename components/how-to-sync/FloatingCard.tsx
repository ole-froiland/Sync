'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface FloatingCardProps {
  children: ReactNode
  className?: string
  /** Entrance + float stagger in seconds. */
  delay?: number
  /** Vertical float amplitude in px. */
  amplitude?: number
  /** Float loop duration in seconds. */
  duration?: number
}

/**
 * A glass surface that fades/scales in, then drifts vertically forever.
 * Honors reduced-motion by holding still after entrance.
 */
export default function FloatingCard({
  children,
  className,
  delay = 0,
  amplitude = 10,
  duration = 6,
}: FloatingCardProps) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.94 }}
      animate={{
        opacity: 1,
        scale: 1,
        y: reduce ? 0 : [0, -amplitude, 0],
      }}
      transition={{
        opacity: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] },
        scale: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] },
        y: reduce
          ? { duration: 0.6, delay }
          : { duration, delay: delay + 0.6, repeat: Infinity, ease: 'easeInOut' },
      }}
      className={cn(
        'rounded-2xl border border-white/60 bg-white/80 shadow-[0_8px_30px_-12px_rgb(0_0_0_/_0.25)] backdrop-blur-md',
        'dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_18px_50px_-20px_rgb(0_0_0_/_0.8)]',
        className,
      )}
    >
      {children}
    </motion.div>
  )
}
