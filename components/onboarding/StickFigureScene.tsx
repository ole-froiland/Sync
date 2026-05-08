'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Lightbulb, Rocket, Code2, Sparkles } from 'lucide-react'

type Stage = 'idle' | 'ideas' | 'confusion' | 'focus' | 'sync' | 'settle'

const STAGE_TIMELINE: { stage: Stage; delay: number }[] = [
  { stage: 'idle', delay: 0 },
  { stage: 'ideas', delay: 1000 },
  { stage: 'confusion', delay: 2500 },
  { stage: 'focus', delay: 4000 },
  { stage: 'sync', delay: 5000 },
  { stage: 'settle', delay: 6500 },
]

const LOOP_RESTART_AT: Stage = 'ideas'
const LOOP_INTERVAL_MS = 9000

const BUBBLES = [
  { id: 'idea', label: 'App idea', Icon: Lightbulb, x: -130, y: -80 },
  { id: 'startup', label: 'Startup', Icon: Rocket, x: 130, y: -90 },
  { id: 'project', label: 'Project', Icon: Sparkles, x: -150, y: 30 },
  { id: 'code', label: 'Code', Icon: Code2, x: 150, y: 20 },
] as const

export default function StickFigureScene() {
  const prefersReducedMotion = useReducedMotion()
  const [animatedStage, setAnimatedStage] = useState<Stage>('idle')
  const stage: Stage = prefersReducedMotion ? 'settle' : animatedStage

  useEffect(() => {
    if (prefersReducedMotion) return

    let cancelled = false
    const timeouts: ReturnType<typeof setTimeout>[] = []

    const runTimeline = (fromIndex: number) => {
      STAGE_TIMELINE.slice(fromIndex).forEach((step, i) => {
        const offset = STAGE_TIMELINE[fromIndex + i].delay - STAGE_TIMELINE[fromIndex].delay
        timeouts.push(
          setTimeout(() => {
            if (!cancelled) setAnimatedStage(step.stage)
          }, offset),
        )
      })
    }

    runTimeline(0)
    const restartIndex = STAGE_TIMELINE.findIndex((s) => s.stage === LOOP_RESTART_AT)
    const loop = setInterval(() => {
      if (!cancelled) runTimeline(restartIndex)
    }, LOOP_INTERVAL_MS)
    timeouts.push(loop as unknown as ReturnType<typeof setTimeout>)

    return () => {
      cancelled = true
      timeouts.forEach((t) => clearTimeout(t))
      clearInterval(loop)
    }
  }, [prefersReducedMotion])

  const showBubbles = stage === 'ideas' || stage === 'confusion'
  const showSync = stage === 'sync' || stage === 'settle'
  const headTilt = stage === 'confusion' ? [-8, 8, -5, 5, 0] : 0
  const figureBounce = stage === 'sync' ? [0, -10, 0] : 0

  const subtitle =
    stage === 'confusion'
      ? 'Not sure where to start?'
      : stage === 'sync' || stage === 'settle'
        ? 'Sync helps you organize everything in one place.'
        : ''

  return (
    <div className="pointer-events-none relative flex w-full flex-1 flex-col items-center justify-center gap-10 px-6">
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
        className="text-center text-[clamp(2.5rem,6vw,4.75rem)] font-semibold leading-[1] tracking-[-0.04em] text-[#171717] dark:text-[#f4ecf7]"
      >
        Want to build something?
      </motion.h1>

      <div className="relative flex h-[340px] w-full max-w-[560px] items-center justify-center sm:h-[380px]">
        <motion.div
          aria-hidden="true"
          className="absolute inset-0 -z-10 rounded-full blur-3xl"
          initial={{ opacity: 0.3, scale: 0.9 }}
          animate={
            prefersReducedMotion
              ? { opacity: 0.55, scale: 1 }
              : { opacity: showSync ? 0.75 : 0.45, scale: showSync ? 1.05 : 0.95 }
          }
          transition={{ duration: 1.2, ease: 'easeOut' }}
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(217,140,255,0.55), rgba(255,160,210,0.35) 40%, transparent 70%)',
          }}
        />

        <div className="relative h-[320px] w-[320px]">
        <AnimatePresence>
          {showBubbles &&
            BUBBLES.map((bubble, index) => (
              <motion.div
                key={bubble.id}
                aria-hidden="true"
                className="absolute left-1/2 top-1/2 flex items-center gap-2 rounded-full bg-white/85 px-4 py-2 text-sm font-medium text-[#3c2c4a] shadow-[0_8px_24px_-12px_rgba(80,30,120,0.45)] backdrop-blur dark:bg-white/10 dark:text-[#f4ecf7] dark:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)] dark:ring-1 dark:ring-white/15"
                style={{ x: bubble.x, y: bubble.y }}
                initial={{ opacity: 0, scale: 0.4, y: bubble.y + 20 }}
                animate={
                  stage === 'confusion'
                    ? {
                        opacity: 1,
                        scale: 1,
                        y: bubble.y + (index % 2 === 0 ? 6 : -6),
                        x: bubble.x + (index % 2 === 0 ? -8 : 8),
                        rotate: index % 2 === 0 ? -3 : 3,
                      }
                    : { opacity: 1, scale: 1, y: bubble.y, x: bubble.x, rotate: 0 }
                }
                exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.35 } }}
                transition={{
                  type: 'spring',
                  stiffness: 220,
                  damping: 18,
                  delay: stage === 'ideas' ? index * 0.12 : 0,
                }}
              >
                <bubble.Icon className="h-4 w-4" strokeWidth={2.25} />
                <span>{bubble.label}</span>
              </motion.div>
            ))}
        </AnimatePresence>

        <AnimatePresence>
          {showSync && (
            <motion.div
              key="sync-glow"
              aria-hidden="true"
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              initial={{ opacity: 0, scale: 0.6, y: -90 }}
              animate={{ opacity: 1, scale: 1, y: -110 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            >
              <div className="relative">
                <div className="absolute inset-0 -z-10 rounded-full bg-gradient-to-tr from-fuchsia-400/60 via-pink-300/50 to-violet-400/60 blur-xl" />
                <div className="rounded-full bg-white/90 px-5 py-2 text-base font-semibold tracking-tight text-[#3c1057] shadow-[0_12px_30px_-10px_rgba(120,40,180,0.55)] dark:bg-white/95">
                  Sync
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          animate={prefersReducedMotion ? { y: 0 } : { y: figureBounce }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <motion.div
            animate={
              prefersReducedMotion
                ? { scaleY: 1 }
                : { scaleY: [1, 1.02, 1] }
            }
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            style={{ transformOrigin: 'center bottom' }}
          >
            <StickFigureSvg headTilt={headTilt} reduced={!!prefersReducedMotion} />
          </motion.div>
        </motion.div>
        </div>
      </div>

      <div className="h-8 text-center text-[clamp(1rem,1.6vw,1.35rem)] leading-snug text-[#3c3428] dark:text-[#cdb6db]">
        <AnimatePresence mode="wait">
          {subtitle && (
            <motion.p
              key={subtitle}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              {subtitle}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function StickFigureSvg({
  headTilt,
  reduced,
}: {
  headTilt: number | number[]
  reduced: boolean
}) {
  return (
    <svg
      width="200"
      height="280"
      viewBox="0 0 200 280"
      fill="none"
      stroke="currentColor"
      strokeWidth="6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-[#1a1024] dark:text-[#f4ecf7]"
      aria-hidden="true"
    >
      <motion.g
        animate={reduced ? { rotate: 0 } : { rotate: headTilt }}
        transition={{ duration: 1.4, ease: 'easeInOut' }}
        style={{ transformOrigin: '100px 60px' }}
      >
        <circle cx="100" cy="60" r="26" />
        <circle cx="92" cy="56" r="2.5" fill="currentColor" stroke="none" />
        <circle cx="108" cy="56" r="2.5" fill="currentColor" stroke="none" />
        <path d="M92 70 Q100 75 108 70" />
      </motion.g>

      <line x1="100" y1="86" x2="100" y2="180" />
      <line x1="100" y1="110" x2="60" y2="150" />
      <line x1="100" y1="110" x2="140" y2="150" />
      <line x1="100" y1="180" x2="72" y2="240" />
      <line x1="100" y1="180" x2="128" y2="240" />
    </svg>
  )
}
