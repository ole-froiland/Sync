import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setVisibleInterval } from './visible-interval'

describe('setVisibleInterval', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('kjører tikk mens fanen er synlig', () => {
    const callback = vi.fn()
    const stop = setVisibleInterval(callback, 1000, () => false)

    vi.advanceTimersByTime(3000)

    expect(callback).toHaveBeenCalledTimes(3)
    stop()
  })

  it('hopper over tikk mens fanen ligger i bakgrunnen', () => {
    const callback = vi.fn()
    const stop = setVisibleInterval(callback, 1000, () => true)

    vi.advanceTimersByTime(10_000)

    expect(callback).not.toHaveBeenCalled()
    stop()
  })

  it('tar opp igjen pollingen når fanen blir synlig', () => {
    const callback = vi.fn()
    let hidden = true
    const stop = setVisibleInterval(callback, 1000, () => hidden)

    vi.advanceTimersByTime(5000)
    expect(callback).not.toHaveBeenCalled()

    hidden = false
    vi.advanceTimersByTime(2000)

    expect(callback).toHaveBeenCalledTimes(2)
    stop()
  })

  it('slutter å kalle callbacken etter at den er stoppet', () => {
    const callback = vi.fn()
    const stop = setVisibleInterval(callback, 1000, () => false)

    vi.advanceTimersByTime(1000)
    stop()
    vi.advanceTimersByTime(5000)

    expect(callback).toHaveBeenCalledTimes(1)
  })
})
