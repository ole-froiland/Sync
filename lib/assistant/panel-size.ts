export const ASSISTANT_PANEL_MIN_WIDTH = 320
export const ASSISTANT_PANEL_DEFAULT_WIDTH = 432
export const ASSISTANT_PANEL_MAX_WIDTH = 720

const DESKTOP_SIDEBAR_WIDTH = 240
const MIN_WORKSPACE_WIDTH = 320

export function assistantPanelMaxWidth(viewportWidth: number) {
  return Math.max(
    ASSISTANT_PANEL_MIN_WIDTH,
    Math.min(ASSISTANT_PANEL_MAX_WIDTH, viewportWidth - DESKTOP_SIDEBAR_WIDTH - MIN_WORKSPACE_WIDTH)
  )
}

export function clampAssistantPanelWidth(width: number, viewportWidth: number) {
  const safeWidth = Number.isFinite(width) ? width : ASSISTANT_PANEL_DEFAULT_WIDTH
  return Math.round(
    Math.min(assistantPanelMaxWidth(viewportWidth), Math.max(ASSISTANT_PANEL_MIN_WIDTH, safeWidth))
  )
}

export function stepAssistantPanelWidth(
  width: number,
  direction: 'smaller' | 'larger',
  viewportWidth: number,
  step = 32
) {
  return clampAssistantPanelWidth(width + (direction === 'larger' ? step : -step), viewportWidth)
}
