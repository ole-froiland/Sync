export interface ViewTransform {
  scale: number
  tx: number
  ty: number
}

export interface ContentBounds {
  left: number
  top: number
  right: number
  bottom: number
}

export const MIN_SCALE = 0.3
export const MAX_SCALE = 2

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
}

/** Zoom by `factor` while keeping the screen point (cx, cy) fixed. */
export function zoomAt(t: ViewTransform, factor: number, cx: number, cy: number): ViewTransform {
  const scale = clampScale(t.scale * factor)
  const k = scale / t.scale
  return {
    scale,
    tx: cx - (cx - t.tx) * k,
    ty: cy - (cy - t.ty) * k,
  }
}

/** Center `contentW x contentH` inside `viewW x viewH`, scaled to fit (never > 1). */
export function computeFit(
  contentW: number,
  contentH: number,
  viewW: number,
  viewH: number,
  padding = 48
): ViewTransform {
  const usableW = Math.max(1, viewW - padding * 2)
  const usableH = Math.max(1, viewH - padding * 2)
  const scale = clampScale(Math.min(usableW / contentW, usableH / contentH, 1))
  return {
    scale,
    tx: (viewW - contentW * scale) / 2,
    ty: (viewH - contentH * scale) / 2,
  }
}

/** Fits a bounded part of the tree inside the viewport, capped at a readable zoom. */
export function computeFitBounds(
  bounds: ContentBounds,
  viewW: number,
  viewH: number,
  padding = 64,
  maxScale = 1.35
): ViewTransform {
  const contentW = Math.max(1, bounds.right - bounds.left)
  const contentH = Math.max(1, bounds.bottom - bounds.top)
  const usableW = Math.max(1, viewW - padding * 2)
  const usableH = Math.max(1, viewH - padding * 2)
  const scale = clampScale(Math.min(usableW / contentW, usableH / contentH, maxScale))
  const centerX = (bounds.left + bounds.right) / 2
  const centerY = (bounds.top + bounds.bottom) / 2
  return {
    scale,
    tx: viewW / 2 - centerX * scale,
    ty: viewH / 2 - centerY * scale,
  }
}
