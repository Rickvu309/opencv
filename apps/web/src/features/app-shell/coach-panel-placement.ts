const SHELL_TOP_INSET = 8
const CARD_BORDER = 1
const PAGE_HEADER_HEIGHT = 52
const DOCK_HEIGHT = 40
const GAP = 8

export const COACH_PANEL_HEIGHT = 600
export const COACH_PANEL_MIN_HEIGHT = 320
export const COACH_PANEL_HEADER_BOTTOM =
  SHELL_TOP_INSET + CARD_BORDER + PAGE_HEADER_HEIGHT
export const COACH_PANEL_DOCK_CLEARANCE = DOCK_HEIGHT + GAP
export const COACH_PANEL_CLEARANCE =
  COACH_PANEL_HEADER_BOTTOM + GAP + COACH_PANEL_DOCK_CLEARANCE
export const COACH_PANEL_SHORTEST_WINDOW =
  COACH_PANEL_MIN_HEIGHT + COACH_PANEL_CLEARANCE
export const COACH_PANEL_ROOM_QUERY = `(min-height: ${COACH_PANEL_SHORTEST_WINDOW}px)`

export type CoachPanelBox = {
  layout: "floating" | "sheet"
  top: number
  bottom: number
  height: number
}

export function coachPanelBox(viewportHeight: number): CoachPanelBox {
  if (viewportHeight < COACH_PANEL_SHORTEST_WINDOW)
    return {
      layout: "sheet",
      top: 0,
      bottom: viewportHeight,
      height: viewportHeight,
    }
  const bottom = viewportHeight - COACH_PANEL_DOCK_CLEARANCE
  const height = Math.min(
    COACH_PANEL_HEIGHT,
    viewportHeight - COACH_PANEL_CLEARANCE
  )
  return { layout: "floating", top: bottom - height, bottom, height }
}
