import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import {
  COACH_PANEL_CLEARANCE,
  COACH_PANEL_DOCK_CLEARANCE,
  COACH_PANEL_HEADER_BOTTOM,
  COACH_PANEL_HEIGHT,
  COACH_PANEL_MIN_HEIGHT,
  COACH_PANEL_ROOM_QUERY,
  COACH_PANEL_SHORTEST_WINDOW,
  coachPanelBox,
  type CoachPanelBox,
} from "./coach-panel-placement.ts"

const here = path.dirname(fileURLToPath(import.meta.url))
const WIDTHS = [820, 1024, 1366, 1440, 1920]
const HEIGHTS = Array.from({ length: 40 }, (_, step) => 300 + step * 20).concat(
  [512, 657, 900, 1080, 436, 437]
)
const STATES = ["empty", "with a chat", "approval waiting"] as const
const DOCK_HEIGHT = 40

type Place = (height: number) => CoachPanelBox

const GRID = WIDTHS.flatMap((width) =>
  HEIGHTS.flatMap((height) => STATES.map((state) => ({ width, height, state })))
)

const label = ({ width, height, state }: (typeof GRID)[number]) =>
  `${width}x${height} ${state}`

function overlaps(place: Place) {
  return GRID.filter(({ height }) => {
    const box = place(height)
    return (
      box.layout === "floating" &&
      (box.top < COACH_PANEL_HEADER_BOTTOM || box.bottom > height - DOCK_HEIGHT)
    )
  }).map(label)
}

function composerOutOfReach(place: Place) {
  return GRID.filter(({ height }) => {
    const box = place(height)
    if (box.layout === "sheet") return box.top !== 0 || box.height !== height
    return box.height < COACH_PANEL_MIN_HEIGHT
  }).map(label)
}

function placementBeforeTheFix(height: number): CoachPanelBox {
  const panelHeight = Math.min(600, Math.max(320, height - 56))
  const bottom = height - 48
  return {
    layout: "floating",
    top: bottom - panelHeight,
    bottom,
    height: panelHeight,
  }
}

function placementWithoutAFloor(height: number): CoachPanelBox {
  const bottom = height - 48
  const panelHeight = Math.max(0, Math.min(600, bottom - 69))
  return {
    layout: "floating",
    top: bottom - panelHeight,
    bottom,
    height: panelHeight,
  }
}

const shellSource = () => readFileSync(path.join(here, "app-shell.tsx"), "utf8")

function floatingClass() {
  const source = shellSource()
  const found = source.match(/floating &&\s*"([^"]+)"/)
  return found?.[1] ?? ""
}

describe("the floating Coach panel sits between the page header and the dock", () => {
  it("never covers the header or the dock in any window size or panel state", () => {
    expect(GRID.length).toBe(WIDTHS.length * HEIGHTS.length * STATES.length)
    expect(overlaps(coachPanelBox)).toEqual([])
  })

  it("keeps the composer in reach down to a 300px window", () => {
    expect(composerOutOfReach(coachPanelBox)).toEqual([])
    expect(coachPanelBox(300).layout).toBe("sheet")
    expect(coachPanelBox(COACH_PANEL_SHORTEST_WINDOW - 1).layout).toBe("sheet")
    expect(coachPanelBox(COACH_PANEL_SHORTEST_WINDOW)).toEqual({
      layout: "floating",
      top: COACH_PANEL_HEADER_BOTTOM + 8,
      bottom: COACH_PANEL_SHORTEST_WINDOW - COACH_PANEL_DOCK_CLEARANCE,
      height: COACH_PANEL_MIN_HEIGHT,
    })
  })

  it("keeps the designed 600px panel at 1440x900", () => {
    expect(coachPanelBox(900)).toEqual({
      layout: "floating",
      top: 252,
      bottom: 852,
      height: 600,
    })
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

  it("fires on the placement that shrank to nothing in a short window", () => {
    expect(composerOutOfReach(placementWithoutAFloor)).toEqual(
      expect.arrayContaining(["1366x300 empty", "1440x420 approval waiting"])
    )
  })

  it("gives the browser the same box the placement rule states", () => {
    const classes = floatingClass().split(/\s+/)
    expect(classes).toEqual(
      expect.arrayContaining([
        "fixed",
        "right-5",
        "bottom-12",
        `h-[${COACH_PANEL_HEIGHT}px]`,
        `max-h-[calc(100dvh-${COACH_PANEL_CLEARANCE}px)]`,
        "w-[400px]",
      ])
    )
    expect(12 * 4).toBe(COACH_PANEL_DOCK_CLEARANCE)
    for (const height of HEIGHTS.filter(
      (each) => each >= COACH_PANEL_SHORTEST_WINDOW
    )) {
      expect(Math.min(COACH_PANEL_HEIGHT, height - COACH_PANEL_CLEARANCE)).toBe(
        coachPanelBox(height).height
      )
    }
    expect(shellSource()).toContain(
      "useMediaQuery(COACH_PANEL_ROOM_QUERY, true)"
    )
    expect(COACH_PANEL_ROOM_QUERY).toBe(
      `(min-height: ${COACH_PANEL_SHORTEST_WINDOW}px)`
    )
  })
})
