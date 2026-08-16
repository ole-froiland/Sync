import { describe, expect, it } from 'vitest'
import { LocalAiLoadGuard } from './local-ai-load-guard.mjs'

describe('local AI load guard', () => {
  it('limits active and queued jobs', () => {
    const guard = new LocalAiLoadGuard({ maxPending: 2, maxPerWindow: 10 })
    expect(guard.tryStart(1)).toBe(true)
    expect(guard.tryStart(2)).toBe(true)
    expect(guard.tryStart(3)).toBe(false)
    guard.finish()
    expect(guard.tryStart(4)).toBe(true)
  })

  it('rate limits starts and recovers after the window', () => {
    const guard = new LocalAiLoadGuard({ maxPending: 10, maxPerWindow: 2, windowMs: 1_000 })
    expect(guard.tryStart(0)).toBe(true)
    guard.finish()
    expect(guard.tryStart(500)).toBe(true)
    guard.finish()
    expect(guard.tryStart(999)).toBe(false)
    expect(guard.tryStart(1_001)).toBe(true)
  })

  it('never lets pending jobs become negative', () => {
    const guard = new LocalAiLoadGuard()
    guard.finish()
    expect(guard.pending).toBe(0)
  })
})
