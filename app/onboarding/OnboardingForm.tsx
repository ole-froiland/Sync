'use client'

import { useState, useTransition } from 'react'
import { onboardingAction } from './actions'

const SLIDES = [
  {
    title: 'Want to build something?',
    lines: [
      'You need one place to keep track of your projects, code, and people.',
      "That's what Sync is for.",
    ],
    cta: 'Continue',
  },
  {
    title: 'Create your first project',
    lines: [
      'Create a new project. Give it a name. Add your repo.',
      'Open it in your favorite AI coder.',
      'Start building.',
    ],
    cta: 'Next',
  },
  {
    title: 'Build together',
    lines: [
      'Invite your friends. Sync with them. Share your project.',
      "Now you're building together in one place.",
    ],
    cta: 'Start syncing',
  },
] as const

export default function OnboardingForm() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isLastSlide = currentSlide === SLIDES.length - 1

  function goToSlide(index: number) {
    setCurrentSlide(Math.max(0, Math.min(index, SLIDES.length - 1)))
  }

  function handleContinue() {
    if (!isLastSlide) {
      goToSlide(currentSlide + 1)
      return
    }

    setError(null)
    startTransition(async () => {
      const result = await onboardingAction(null, new FormData())
      if (result?.error) setError(result.error)
    })
  }

  return (
    <main className="relative flex min-h-screen overflow-hidden bg-[#f6f1e8] text-[#171717]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.88),_transparent_55%),linear-gradient(135deg,_#f6f1e8_0%,_#efe3cf_48%,_#e7d3b0_100%)]" />

      <div className="relative flex w-full flex-col justify-between px-6 py-8 sm:px-10 sm:py-10">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold uppercase tracking-[0.3em] text-[#7a5c2e]">
            Sync
          </span>
          <div className="flex items-center gap-2">
            {SLIDES.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => goToSlide(index)}
                aria-label={`Go to slide ${index + 1}`}
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  index === currentSlide ? 'w-8 bg-[#171717]' : 'w-2.5 bg-[#171717]/20 hover:bg-[#171717]/35'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-6xl flex-1 items-center overflow-hidden">
          <div
            className="flex w-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ transform: `translateX(-${currentSlide * 100}%)` }}
          >
            {SLIDES.map((slide) => (
              <section
                key={slide.title}
                className="flex min-w-full flex-col items-center justify-center px-2 text-center"
              >
                <div className="max-w-4xl">
                  <h1 className="text-[clamp(2.75rem,7vw,5.75rem)] font-semibold leading-[0.95] tracking-[-0.04em]">
                    {slide.title}
                  </h1>
                  <div className="mt-8 space-y-4 text-[clamp(1.1rem,2vw,1.65rem)] leading-[1.15] text-[#3c3428]">
                    {slide.lines.map((line) => (
                      <p key={line} className="mx-auto max-w-3xl">
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              </section>
            ))}
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-6xl items-end justify-between gap-4">
          <button
            type="button"
            onClick={() => goToSlide(currentSlide - 1)}
            disabled={currentSlide === 0 || isPending}
            className="min-w-20 text-sm font-medium text-[#171717] transition-opacity hover:opacity-65 disabled:cursor-not-allowed disabled:opacity-20"
          >
            Back
          </button>

          <div className="flex flex-col items-center gap-3">
            {error ? (
              <p className="text-sm text-[#9f2c2c]">{error}</p>
            ) : (
              <p className="text-xs uppercase tracking-[0.25em] text-[#7a5c2e]">
                Create. Connect. Invite. Build.
              </p>
            )}
            <button
              type="button"
              onClick={handleContinue}
              disabled={isPending}
              className="inline-flex min-w-40 items-center justify-center rounded-full bg-[#171717] px-6 py-3 text-sm font-semibold text-[#f6f1e8] transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
            >
              {isPending ? 'Starting…' : SLIDES[currentSlide].cta}
            </button>
          </div>

          <div className="min-w-20 text-right text-sm font-medium text-[#171717]/45">
            {currentSlide + 1}/{SLIDES.length}
          </div>
        </div>
      </div>
    </main>
  )
}
