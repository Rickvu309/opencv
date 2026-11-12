import { describe, expect, it } from "vitest"

import {
  COACH_PANEL_DOCK_CLEARANCE,
  COACH_PANEL_HEADER_BOTTOM,
  coachPanelBox,
  coachPanelFloatingStyle,
} from "./coach-panel-placement.ts"

const WIDTHS = [820, 1024, 1366, 1440, 1920]
const HEIGHTS = Array.from({ length: 13 }, (_, step) => 480 + step * 50).concat(
  [512, 657, 900, 1080]
)
const STATES = ["empty", "with a chat", "approval waiting"] as const
const DOCK_HEIGHT = 40

type Box = { top: number; bottom: number; height: number }

const GRID = WIDTHS.flatMap((width) =>
  HEIGHTS.flatMap((height) => STATES.map((state) => ({ width, height, state })))
)

function overlaps(place: (height: number) => Box) {
  return GRID.filter(({ height }) => {
    const box = place(height)
    return (
      box.top < COACH_PANEL_HEADER_BOTTOM || box.bottom > height - DOCK_HEIGHT
    )
  }).map(({ width, height, state }) => `${width}x${height} ${state}`)
}

function placementBeforeTheFix(height: number): Box {
  const panelHeight = Math.min(600, Math.max(320, height - 56))
  const bottom = height - 48
  return { top: bottom - panelHeight, bottom, height: panelHeight }
}

describe("the floating Coach panel sits between the page header and the dock", () => {
  it("never covers the header or the dock in any window size or panel state", () => {
    expect(GRID.length).toBe(WIDTHS.length * HEIGHTS.length * STATES.length)
    expect(overlaps(coachPanelBox)).toEqual([])
  })

  it("keeps the designed 600px panel at 1440x900", () => {
    expect(coachPanelBox(900)).toEqual({ top: 252, bottom: 852, height: 600 })
  })

  it("fires on the placement that climbed over Download Word", () => {
    expect(overlaps(placementBeforeTheFix)).toEqual(
      expect.arrayContaining([
        "1366x657 empty",
        "820x512 approval waiting",
        "1920x480 with a chat",
      ])
    )
  })

  it("gives the browser the same height and bottom for every window height", () => {
    const formula = coachPanelFloatingStyle.blockSize.match(
      /^max\(0px, min\((\d+)px, calc\(100dvh - (\d+)px\)\)\)$/
    )
    expect(formula).not.toBeNull()
    const [, most, clearance] = (formula ?? []).map(Number)
    for (const height of HEIGHTS) {
      expect(Math.max(0, Math.min(most ?? 0, height - (clearance ?? 0)))).toBe(
        coachPanelBox(height).height
      )
    }
    expect(coachPanelFloatingStyle.insetBlockEnd).toBe(
      `${COACH_PANEL_DOCK_CLEARANCE}px`
    )
    expect(coachPanelBox(900).bottom).toBe(900 - COACH_PANEL_DOCK_CLEARANCE)
  })
})
