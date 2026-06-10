'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Pause, Play } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import SyncWithOthersModal from '@/components/how-to-sync/SyncWithOthersModal'
import Background from '@/components/how-to-sync/Background'
import Progress from '@/components/how-to-sync/Progress'
import Stage from '@/components/how-to-sync/Stage'
import CTACard from '@/components/how-to-sync/CTACard'
import { STEPS } from '@/components/how-to-sync/steps'
import { useUser } from '@/context/UserContext'

export default function HowToSyncPage() {
  const profile = useUser()
  const reduce = useReducedMotion()
  const [[index, direction], setState] = useState<[number, number]>([0, 1])
  const [modalOpen, setModalOpen] = useState(false)
  const [hoverPaused, setHoverPaused] = useState(false)
  const [userPaused, setUserPaused] = useState(false)

  const step = STEPS[index]
  const isLast = index === STEPS.length - 1
  const playing = !userPaused && !hoverPaused && !isLast && !modalOpen

  const goTo = useCallback((next: number) => {
    setState(([prev]) => [next, next >= prev ? 1 : -1])
  }, [])

  const next = useCallback(() => {
    setState(([prev]) => [Math.min(prev + 1, STEPS.length - 1), 1])
  }, [])

  const prev = useCallback(() => {
    setState(([prev]) => [Math.max(prev - 1, 0), -1])
  }, [])

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (modalOpen) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prev()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, modalOpen])

  const textOffset = reduce ? 0 : 14

  return (
    <>
      <TopBar title="How to Sync" />

      <section
        aria-label="Sync product walkthrough"
        className="relative flex-1 overflow-hidden"
        style={{ '--accent': step.accent } as React.CSSProperties}
        onMouseEnter={() => setHoverPaused(true)}
        onMouseLeave={() => setHoverPaused(false)}
      >
        <Background accentRgb={step.accentRgb} />

        <div className="relative z-10 h-full overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col items-center gap-10 px-6 py-10 lg:flex-row lg:items-center lg:gap-16 lg:px-10 lg:py-0">
            {/* ── Narrative ── */}
            <div className="order-2 flex w-full flex-col lg:order-1 lg:w-[44%]">
              {/* Eyebrow + counter */}
              <div className="flex items-center justify-between">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={step.id + '-eyebrow'}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.35 }}
                    className="inline-flex items-center gap-2 rounded-full border border-gray-200/80 bg-white/70 px-3 py-1 text-xs font-medium backdrop-blur dark:border-white/10 dark:bg-white/5"
                    style={{ color: step.accent }}
                  >
                    <step.icon size={13} />
                    {step.eyebrow}
                  </motion.span>
                </AnimatePresence>
                <span className="font-mono text-xs tabular-nums text-gray-400 dark:text-gray-500">
                  {String(index + 1).padStart(2, '0')}
                  <span className="mx-1 opacity-50">/</span>
                  {String(STEPS.length).padStart(2, '0')}
                </span>
              </div>

              {/* Title + subtitle */}
              <div className="relative mt-6 min-h-[8.5rem] sm:min-h-[9.5rem]" aria-live="polite">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step.id + '-text'}
                    initial={{ opacity: 0, y: textOffset }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -textOffset }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <h2 className="text-balance text-3xl font-semibold leading-[1.1] tracking-tight text-gray-900 dark:text-white sm:text-4xl lg:text-[2.6rem]">
                      {step.title}
                    </h2>
                    <p className="mt-4 max-w-md text-pretty text-base leading-relaxed text-gray-600 dark:text-gray-400">
                      {step.subtitle}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Progress */}
              <div className="mt-8">
                <Progress
                  current={index}
                  accent={step.accent}
                  playing={playing}
                  onSelect={goTo}
                  onComplete={next}
                />
                <span className="sr-only" aria-live="polite">
                  Step {index + 1} of {STEPS.length}: {step.title}
                </span>
              </div>

              {/* Controls / CTA */}
              <div className="mt-7">
                <AnimatePresence mode="wait">
                  {isLast ? (
                    <motion.div
                      key="cta"
                      initial={{ opacity: 0, y: textOffset }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -textOffset }}
                      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <CTACard onInvite={() => setModalOpen(true)} />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="controls"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="flex items-center gap-3"
                    >
                      <button
                        type="button"
                        onClick={prev}
                        disabled={index === 0}
                        aria-label="Previous step"
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200/80 bg-white/70 text-gray-600 backdrop-blur transition-all hover:bg-white hover:text-gray-900 disabled:opacity-40 disabled:hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
                      >
                        <ArrowLeft size={18} />
                      </button>

                      <button
                        type="button"
                        onClick={next}
                        className="group inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-fuchsia-500 px-5 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:shadow-xl hover:shadow-purple-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                      >
                        Next
                        <ArrowRight
                          size={16}
                          className="transition-transform group-hover:translate-x-0.5"
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() => setUserPaused((p) => !p)}
                        aria-label={userPaused ? 'Resume autoplay' : 'Pause autoplay'}
                        className="ml-1 flex h-11 w-11 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100/70 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent dark:hover:bg-white/10 dark:hover:text-gray-200"
                      >
                        {userPaused ? <Play size={16} /> : <Pause size={16} />}
                      </button>

                      <span className="ml-auto hidden text-xs text-gray-400 dark:text-gray-500 sm:inline">
                        Use{' '}
                        <kbd className="rounded border border-gray-200 px-1 font-sans dark:border-white/15">
                          ←
                        </kbd>{' '}
                        <kbd className="rounded border border-gray-200 px-1 font-sans dark:border-white/15">
                          →
                        </kbd>{' '}
                        to navigate
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* ── Stage ── */}
            <div className="order-1 w-full lg:order-2 lg:w-[56%]">
              <Stage step={step} direction={direction} />
            </div>
          </div>
        </div>
      </section>

      <SyncWithOthersModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        userId={profile?.id ?? ''}
      />
    </>
  )
}
