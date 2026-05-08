'use client'

import { useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import SyncWithOthersModal from '@/components/how-to-sync/SyncWithOthersModal'
import Button from '@/components/ui/Button'
import { useUser } from '@/context/UserContext'

const SLIDES = [
  {
    title: 'Want to build something?',
    text: 'Sync gives you one place for your projects, code, and people.',
    cta: 'Start',
  },
  {
    title: 'Create a project',
    text: 'Give it a name, connect a repo, and keep everything organized.',
    cta: 'Next',
  },
  {
    title: 'Open it where you build',
    text: 'Use GitHub, VS Code, Cursor, Codex, or your favorite AI coding tool.',
    cta: 'Next',
  },
  {
    title: 'Sync with your team',
    text: 'Invite friends, share projects, and work together in one place.',
    cta: 'Start syncing',
  },
] as const

export default function HowToSyncPage() {
  const profile = useUser()
  const [currentSlide, setCurrentSlide] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)

  const isFirstSlide = currentSlide === 0
  const isLastSlide = currentSlide === SLIDES.length - 1

  function goToSlide(index: number) {
    setCurrentSlide(Math.max(0, Math.min(index, SLIDES.length - 1)))
  }

  function handlePrimaryAction() {
    if (isLastSlide) {
      setModalOpen(true)
      return
    }

    goToSlide(currentSlide + 1)
  }

  return (
    <>
      <TopBar
        title="How to Sync"
        className="border-white/10 bg-[#050816] text-white"
        titleClassName="text-white"
      />

      <div className="relative flex flex-1 overflow-hidden bg-[#050816] text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(217,70,239,0.16),_transparent_30%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.14),_transparent_24%),linear-gradient(180deg,#050816_0%,#090d1f_100%)]" />
        <div className="pointer-events-none absolute -left-20 top-24 h-72 w-72 rounded-full bg-fuchsia-500/12 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-purple-500/12 blur-3xl" />

        <div className="relative flex w-full flex-1 flex-col overflow-hidden px-6 py-6 md:px-10 md:py-8">
          <div className="flex items-center justify-between">
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.28em] text-fuchsia-200/90">
              Sync onboarding
            </span>
            <div className="text-sm text-white/45">
              {currentSlide + 1}/{SLIDES.length}
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-6xl flex-1 items-center overflow-hidden">
            <div
              className="flex w-full h-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ transform: `translateX(-${currentSlide * 100}%)` }}
            >
              {SLIDES.map((slide, index) => (
                <section
                  key={slide.title}
                  aria-hidden={index !== currentSlide}
                  className="flex min-w-full items-center justify-center py-6"
                >
                  <div className="w-full max-w-4xl text-center">
                    <div className="mx-auto max-w-3xl rounded-[2rem] border border-white/10 bg-white/[0.04] px-8 py-12 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur md:px-14 md:py-16">
                      <p className="text-xs font-medium uppercase tracking-[0.3em] text-white/35">
                        Step {index + 1}
                      </p>
                      <h1 className="mt-6 text-[clamp(3rem,7vw,6rem)] font-semibold leading-[0.92] tracking-[-0.05em] text-white">
                        {slide.title}
                      </h1>
                      <p className="mx-auto mt-6 max-w-2xl text-[clamp(1.05rem,2.1vw,1.45rem)] leading-[1.35] text-white/68">
                        {slide.text}
                      </p>

                      <div className="mt-10">
                        <Button
                          size="lg"
                          onClick={handlePrimaryAction}
                          className="min-h-14 rounded-full px-8 text-base font-semibold shadow-[0_0_36px_rgba(217,70,239,0.28)]"
                        >
                          {slide.cta}
                          {!isLastSlide ? <ArrowRight size={18} /> : null}
                        </Button>
                      </div>
                    </div>
                  </div>
                </section>
              ))}
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => goToSlide(currentSlide - 1)}
              disabled={isFirstSlide}
              className="inline-flex min-w-24 items-center gap-2 text-sm font-medium text-white/72 transition hover:text-white disabled:pointer-events-none disabled:text-white/20"
            >
              <ArrowLeft size={16} />
              Back
            </button>

            <div className="flex items-center gap-3">
              {SLIDES.map((slide, index) => (
                <button
                  key={slide.title}
                  type="button"
                  onClick={() => goToSlide(index)}
                  aria-label={`Go to step ${index + 1}`}
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    index === currentSlide
                      ? 'w-10 bg-gradient-to-r from-fuchsia-400 to-purple-400'
                      : 'w-2.5 bg-white/20 hover:bg-white/35'
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={handlePrimaryAction}
              className="inline-flex min-w-24 items-center justify-end gap-2 text-sm font-medium text-white/72 transition hover:text-white"
            >
              {isLastSlide ? 'Start syncing' : 'Next'}
              {!isLastSlide ? <ArrowRight size={16} /> : null}
            </button>
          </div>
        </div>
      </div>

      <SyncWithOthersModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        userId={profile?.id ?? ''}
      />
    </>
  )
}
