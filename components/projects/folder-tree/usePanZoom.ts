'use client'

import { useCallback, useRef, useState } from 'react'
import { clampScale, computeFit, computeFitBounds, zoomAt, type ContentBounds, type ViewTransform } from './panzoom-math'

const ZOOM_STEP = 1.2
/** Movement (px) before a press turns into a pan. Below this, it stays a click. */
const DRAG_THRESHOLD = 4

interface DragState {
  x: number
  y: number
  tx: number
  ty: number
  active: boolean
  pointerId: number
  el: HTMLElement
}

export function usePanZoom() {
  const [t, setT] = useState<ViewTransform>({ scale: 1, tx: 0, ty: 0 })
  const drag = useRef<DragState | null>(null)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return
      // Record the press but DON'T capture the pointer yet. Capturing on
      // pointerdown retargets the pointerup to the canvas, so the synthetic
      // click lands on the canvas instead of the child button under the cursor —
      // which breaks expand/collapse and the node toolbar. We only capture once
      // the pointer actually moves past DRAG_THRESHOLD (i.e. a real pan begins).
      drag.current = {
        x: e.clientX,
        y: e.clientY,
        tx: t.tx,
        ty: t.ty,
        active: false,
        pointerId: e.pointerId,
        el: e.currentTarget as HTMLElement,
      }
    },
    [t.tx, t.ty]
  )

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.active) {
      if (Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return
      d.active = true
      try {
        d.el.setPointerCapture(d.pointerId)
      } catch {
        // capture is best-effort
      }
    }
    setT((prev) => ({ ...prev, tx: d.tx + dx, ty: d.ty + dy }))
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    if (d?.active) {
      try {
        ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {
        // capture may already be released
      }
    }
  }, [])

  const onWheel = useCallback((e: React.WheelEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
    setT((prev) => zoomAt(prev, factor, cx, cy))
  }, [])

  const zoomIn = useCallback((cx: number, cy: number) => setT((p) => zoomAt(p, ZOOM_STEP, cx, cy)), [])
  const zoomOut = useCallback((cx: number, cy: number) => setT((p) => zoomAt(p, 1 / ZOOM_STEP, cx, cy)), [])
  const setScaleAbsolute = useCallback((scale: number) => setT((p) => ({ ...p, scale: clampScale(scale) })), [])

  const fit = useCallback((contentW: number, contentH: number, viewW: number, viewH: number) => {
    setT(computeFit(contentW, contentH, viewW, viewH))
  }, [])

  const fitBounds = useCallback((bounds: ContentBounds, viewW: number, viewH: number) => {
    setT(computeFitBounds(bounds, viewW, viewH))
  }, [])

  return {
    transform: t,
    bind: { onPointerDown, onPointerMove, onPointerUp, onWheel },
    zoomIn,
    zoomOut,
    setScaleAbsolute,
    fit,
    fitBounds,
  }
}
