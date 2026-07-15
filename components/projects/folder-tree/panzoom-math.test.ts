import { describe, expect, it } from 'vitest'
import { centerOnPoint, clampScale, computeFit, zoomAt } from './panzoom-math'

describe('clampScale', () => {
  it('clamps to [0.3, 2]', () => {
    expect(clampScale(0.1)).toBe(0.3)
    expect(clampScale(5)).toBe(2)
    expect(clampScale(1)).toBe(1)
  })
})

describe('zoomAt', () => {
  it('keeps the point under the cursor fixed', () => {
    const start = { scale: 1, tx: 0, ty: 0 }
    const cx = 200
    const cy = 100
    const worldX = (cx - start.tx) / start.scale
    const next = zoomAt(start, 1.2, cx, cy)
    expect(next.tx + worldX * next.scale).toBeCloseTo(cx, 5)
    expect(next.scale).toBeCloseTo(1.2, 5)
  })
})

describe('computeFit', () => {
  it('centers content and never scales above 1', () => {
    const t = computeFit(200, 100, 1000, 600, 0)
    expect(t.scale).toBe(1)
    expect(t.tx).toBeCloseTo((1000 - 200) / 2, 5)
    expect(t.ty).toBeCloseTo((600 - 100) / 2, 5)
  })

  it('scales down to fit oversized content', () => {
    const t = computeFit(2000, 100, 1000, 600, 0)
    expect(t.scale).toBeCloseTo(0.5, 5)
  })
})

describe('centerOnPoint', () => {
  it('places the chosen world point in the center of the viewport', () => {
    const t = centerOnPoint(300, 180, 1000, 600, 1.35)

    expect(t.tx + 300 * t.scale).toBeCloseTo(500, 5)
    expect(t.ty + 180 * t.scale).toBeCloseTo(300, 5)
    expect(t.scale).toBeCloseTo(1.35, 5)
  })

  it('keeps the requested focus scale within the zoom limits', () => {
    expect(centerOnPoint(0, 0, 1000, 600, 10).scale).toBe(2)
  })
})
