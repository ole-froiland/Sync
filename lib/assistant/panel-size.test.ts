import { describe, expect, it } from 'vitest'
import {
  ASSISTANT_PANEL_DEFAULT_WIDTH,
  ASSISTANT_PANEL_MAX_WIDTH,
  ASSISTANT_PANEL_MIN_WIDTH,
  assistantPanelMaxWidth,
  clampAssistantPanelWidth,
  stepAssistantPanelWidth,
} from './panel-size'

describe('assistant panel sizing', () => {
  it('keeps enough room for the sidebar and workspace', () => {
    expect(assistantPanelMaxWidth(1024)).toBe(464)
    expect(assistantPanelMaxWidth(1600)).toBe(ASSISTANT_PANEL_MAX_WIDTH)
  })

  it('clamps dragged and restored widths', () => {
    expect(clampAssistantPanelWidth(100, 1440)).toBe(ASSISTANT_PANEL_MIN_WIDTH)
    expect(clampAssistantPanelWidth(900, 1440)).toBe(ASSISTANT_PANEL_MAX_WIDTH)
    expect(clampAssistantPanelWidth(Number.NaN, 1440)).toBe(ASSISTANT_PANEL_DEFAULT_WIDTH)
  })

  it('supports keyboard-sized steps', () => {
    expect(stepAssistantPanelWidth(432, 'smaller', 1440)).toBe(400)
    expect(stepAssistantPanelWidth(432, 'larger', 1440)).toBe(464)
  })
})
