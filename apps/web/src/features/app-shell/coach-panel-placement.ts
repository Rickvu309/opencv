const SHELL_TOP_INSET = 8
const CARD_BORDER = 1
const PAGE_HEADER_HEIGHT = 52
const DOCK_HEIGHT = 40
const GAP = 8

export const COACH_PANEL_MAX_HEIGHT = 600
export const COACH_PANEL_HEADER_BOTTOM =
  SHELL_TOP_INSET + CARD_BORDER + PAGE_HEADER_HEIGHT
export const COACH_PANEL_DOCK_CLEARANCE = DOCK_HEIGHT + GAP
const HEADER_CLEARANCE = COACH_PANEL_HEADER_BOTTOM + GAP

export function coachPanelBox(viewportHeight: number) {
  const bottom = viewportHeight - COACH_PANEL_DOCK_CLEARANCE
  const height = Math.max(
    0,
    Math.min(COACH_PANEL_MAX_HEIGHT, bottom - HEADER_CLEARANCE)
  )
  return { top: bottom - height, bottom, height }
}

export const coachPanelFloatingStyle = {
  insetBlockEnd: `${COACH_PANEL_DOCK_CLEARANCE}px`,
  blockSize: `max(0px, min(${COACH_PANEL_MAX_HEIGHT}px, calc(100dvh - ${COACH_PANEL_DOCK_CLEARANCE + HEADER_CLEARANCE}px)))`,
}
