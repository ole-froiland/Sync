'use client'

import { useCallback, useRef, useState } from 'react'
import { clampScale, computeFit, zoomAt, type ViewTransform } from './panzoom-math'

const ZOOM_STEP = 1.2

export function usePanZoom() {
  const [t, setT] = useState<ViewTransform>({ scale: 1, tx: 0, ty: 0 })
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, tx: t.tx, ty: t.ty }
  }, [t.tx, t.ty])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return
    setT((prev) => ({
      ...prev,
      tx: drag.current!.tx + (e.clientX - drag.current!.x),
      ty: drag.current!.ty + (e.clientY - drag.current!.y),
    }))
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    drag.current = null
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      // capture may already be released
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

  return {
    transform: t,
    bind: { onPointerDown, onPointerMove, onPointerUp, onWheel },
    zoomIn,
    zoomOut,
    setScaleAbsolute,
    fit,
  }
}
