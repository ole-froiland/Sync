'use client'

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import Scene from './scenes'
import type { Step } from './steps'

/**
 * The framed "preview" surface. Holds a layered glass panel and cross-fades the
 * active step's custom illustration. Accent-tinted glow reacts to the step.
 */
export default function Stage({ step, direction }: { step: Step; direction: number }) {
  const reduce = useReducedMotion()

  return (
    <div className="relative mx-auto aspect-[5/4] w-full max-w-[560px] sm:aspect-[16/11]">
      {/* Accent glow behind the panel */}
      <div
        aria-hidden
        className="absolute -inset-6 rounded-[2rem] opacity-70 blur-2xl transition-[background] duration-1000"
        style={{
          background: `radial-gradient(60% 60% at 50% 40%, ${step.accent}33, transparent 70%)`,
        }}
      />

      {/* Glass panel */}
      <div className="relative h-full w-full overflow-hidden rounded-[1.75rem] border border-white/70 bg-gradient-to-b from-white/80 to-white/40 shadow-[0_30px_80px_-30px_rgb(0_0_0_/_0.45)] backdrop-blur-xl dark:border-white/10 dark:from-white/[0.06] dark:to-white/[0.01] dark:shadow-[0_40px_120px_-40px_rgb(0_0_0_/_0.9)]">
        {/* Top sheen */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent dark:via-white/30" />
        {/* Moving sheen */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="htw-sheen absolute -inset-y-10 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent dark:via-white/[0.06]" />
        </div>

        <div className="absolute inset-0 p-4 sm:p-6">
          <div className="relative h-full w-full">
            <AnimatePresence mode="popLayout" custom={direction}>
              <motion.div
                key={step.id}
                custom={direction}
                initial={
                  reduce
                    ? { opacity: 0 }
                    : { opacity: 0, x: direction > 0 ? 36 : -36, scale: 0.97 }
                }
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={
                  reduce
                    ? { opacity: 0 }
                    : { opacity: 0, x: direction > 0 ? -36 : 36, scale: 0.97 }
                }
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0"
              >
                <Scene id={step.id} accent={step.accent} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
