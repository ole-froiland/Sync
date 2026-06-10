'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { STEPS, STEP_DURATION_MS } from './steps'

interface ProgressProps {
  current: number
  accent: string
  /** When true the active segment fills over STEP_DURATION_MS, then calls onComplete. */
  playing: boolean
  onSelect: (index: number) => void
  onComplete: () => void
}

/**
 * Segmented walkthrough progress. The active segment doubles as the autoplay
 * clock: its fill animation drives `onComplete`, keeping bar and step in sync.
 */
export default function Progress({
  current,
  accent,
  playing,
  onSelect,
  onComplete,
}: ProgressProps) {
  const reduce = useReducedMotion()

  return (
    <ol className="flex w-full items-center gap-2" aria-hidden>
      {STEPS.map((step, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={step.id} className="min-w-0 flex-1">
            <button
              type="button"
              tabIndex={-1}
              onClick={() => onSelect(i)}
              className="group relative block h-1.5 w-full overflow-hidden rounded-full bg-gray-200/80 transition-colors dark:bg-white/10"
            >
              {done && (
                <span
                  className="absolute inset-0 rounded-full"
                  style={{ backgroundColor: accent }}
                />
              )}
              {active &&
                (playing && !reduce ? (
                  <motion.span
                    key={`${i}-fill`}
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ backgroundColor: accent }}
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{
                      duration: STEP_DURATION_MS / 1000,
                      ease: 'linear',
                    }}
                    onAnimationComplete={onComplete}
                  />
                ) : (
                  <span
                    className="absolute inset-y-0 left-0 w-1/2 rounded-full"
                    style={{ backgroundColor: accent }}
                  />
                ))}
            </button>
          </li>
        )
      })}
    </ol>
  )
}
