import { afterEach, describe, expect, it } from "vitest"

import {
  TOAST_OFFSET_BOTTOM,
  TOAST_OFFSET_RIGHT,
} from "@workspace/ui/lib/toast-offset"
import { GRID } from "@workspace/ui/lib/viewport-grid"
import {
  keepToastsClearOf,
  TOAST_CLEARANCE_GAP_PX,
  TOAST_MIN_WIDTH_PX,
  toastBoxAt,
  toastSpot,
  type ToastBox,
  type ToastRoom,
  type ToastSpot,
} from "@/lib/toast-clearance.ts"

const ERROR_TOAST_HEIGHT = 54
const UNDO_TOAST_HEIGHT = 58
const SONNER_STACK_PEEK_PX = 14
const DESKTOP_MIN_WIDTH = 768
const DESKTOP_FRAME = { left: 245, top: 9 }
const PHONE_FRAME = { left: 0, top: 48 }
const PAGE_HEADER_HEIGHT = 52
const PANEL_HEADER_HEIGHT = 48

type PanelState = "closed" | "open" | "chat page"

type Layout = {
  room: ToastRoom
  panel: ToastBox | null
  keepOff: Record<string, ToastBox>
}

const box = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  width,
  height,
})

const overlaps = (a: ToastBox, b: ToastBox) =>
  a.left < b.left + b.width &&
  b.left < a.left + a.width &&
  a.top < b.top + b.height &&
  b.top < a.top + a.height

const within = (outer: ToastBox, inner: ToastBox) =>
  inner.left >= outer.left &&
  inner.top >= outer.top &&
  inner.left + inner.width <= outer.left + outer.width &&
  inner.top + inner.height <= outer.top + outer.height

function layout(
  width: number,
  height: number,
  state: PanelState,
  toastHeight = UNDO_TOAST_HEIGHT
): Layout {
  const desktop = width >= DESKTOP_MIN_WIDTH
  const phoneToast = width <= 600
  const frame = desktop ? DESKTOP_FRAME : PHONE_FRAME
  const dock = desktop
    ? box(frame.left, height - 40, width - frame.left, 40)
    : box(0, height - 48, width, 48)
  const panelHeight = Math.min(600, Math.max(320, height - 56))
  const panel =
    state === "open" && desktop
      ? box(width - 420, height - 48 - panelHeight, 400, panelHeight)
      : null
  const sheetComposer = box(12, height - 110, width - 24, 62)
  const chatColumn = Math.min(720, width - frame.left - 32)
  const chatComposer = desktop
    ? box(
        frame.left + (width - frame.left - chatColumn) / 2,
        height - 155,
        chatColumn,
        107
      )
    : box(12, height - 168, width - 24, 120)
  const composer =
    state === "chat page"
      ? chatComposer
      : panel
        ? box(panel.left + 12, panel.top + panel.height - 90, 376, 78)
        : state === "open"
          ? sheetComposer
          : null
  const account = desktop ? box(10, height - 52, 224, 40) : null
  const obstacles = [dock, account, panel, composer].filter(
    (obstacle): obstacle is ToastBox => obstacle !== null
  )
  const headerControls = desktop
    ? {
        "New on Paper home": box(width - 99, 19, 74, 32),
        "Download Word": box(width - 153, 13, 128, 32),
        "New job": box(width - 115, 21, 90, 28),
        "New chat": box(frame.left + 12, 21, 92, 28),
      }
    : {
        "New on Paper home": box(width - 69, 64, 53, 44),
        "Download Word": box(width - 144, 46, 128, 44),
        "New job": box(width - 106, 52, 90, 44),
        "New chat": box(12, 52, 92, 44),
      }
  return {
    room: {
      viewport: { width, height },
      toast: { width: phoneToast ? width - 32 : 356, height: toastHeight },
      corner: phoneToast ? 16 : 24,
      pageTop: frame.top,
      obstacles,
    },
    panel,
    keepOff: {
      ...headerControls,
      "page header row": box(0, 0, width, frame.top + PAGE_HEADER_HEIGHT),
      "dock bar": dock,
      ...(account ? { Account: account } : {}),
      ...(composer
        ? {
            composer,
            Send: box(
              composer.left + composer.width - 40,
              composer.top + composer.height - 40,
              32,
              32
            ),
          }
        : {}),
      ...(panel
        ? {
            "Coach panel header row": box(
              panel.left,
              panel.top,
              panel.width,
              PANEL_HEADER_HEIGHT
            ),
          }
        : {}),
    },
  }
}

function boxFaults(
  { room, panel, keepOff }: Layout,
  toast: ToastBox,
  name = "toast"
) {
  const faults: string[] = []
  if (!within(box(0, 0, room.viewport.width, room.viewport.height), toast))
    faults.push(`${name} off screen at ${toast.left},${toast.top}`)
  for (const [control, area] of Object.entries(keepOff))
    if (overlaps(toast, area)) faults.push(`${name} covers ${control}`)
  if (panel && !within(panel, toast) && overlaps(toast, panel))
    faults.push(`${name} covers the Coach panel beside it`)
  return faults
}

function placementFaults(layout: Layout, spot: ToastSpot) {
  const toast = toastBoxAt(layout.room, spot)
  return [
    ...boxFaults(layout, toast),
    ...(toast.width < TOAST_MIN_WIDTH_PX
      ? [`narrower than ${TOAST_MIN_WIDTH_PX}px`]
      : []),
  ]
}

function collapsedStack(front: ToastBox, count: number): ToastBox {
  const peek = (count - 1) * SONNER_STACK_PEEK_PX
  return box(front.left, front.top - peek, front.width, peek)
}

function liftAboveEveryObstacle(room: ToastRoom): ToastSpot {
  return {
    right: room.corner,
    width: room.toast.width,
    bottom:
      Math.max(
        ...room.obstacles.map((obstacle) => room.viewport.height - obstacle.top)
      ) + TOAST_CLEARANCE_GAP_PX,
  }
}

const GRID_WIDTHS = [
  320, 360, 390, 414, 600, 768, 780, 800, 807, 808, 820, 1024, 1280, 1366, 1440,
  1920,
]
const GRID_HEIGHTS = [480, 568, 600, 657, 700, 768, 780, 844, 900, 1080]
const states: PanelState[] = ["closed", "open", "chat page"]
const toastKinds = [
  ["error", ERROR_TOAST_HEIGHT],
  ["Undo", UNDO_TOAST_HEIGHT],
] as const
const grid = GRID_WIDTHS.flatMap((width) =>
  GRID_HEIGHTS.flatMap((height) =>
    states.flatMap((state) =>
      toastKinds.map(([kind, toastHeight]) => ({
        name: `${kind} ${width}x${height} ${state}`,
        layout: layout(width, height, state, toastHeight),
      }))
    )
  )
)

function gridFaults(place: (room: ToastRoom) => ToastSpot) {
  return grid.flatMap(({ name, layout }) =>
    placementFaults(layout, place(layout.room)).map(
      (fault) => `${name}: ${fault}`
    )
  )
}

const PANEL_FULL_SCREEN_BELOW_HEIGHT = 437

function chromeButtons(width: number, height: number) {
  return width >= DESKTOP_MIN_WIDTH
    ? { "Coach dock button": box(width - 123, height - 34, 81, 28) }
    : {
        "Menu button": box(8, 2, 44, 44),
        "Coach dock button": box(width - 128, height - 40, 72, 32),
      }
}

function chromeFaults(
  width: number,
  height: number,
  state: PanelState,
  toastHeight: number
) {
  const { room } = layout(width, height, state, toastHeight)
  const toast = toastBoxAt(room, toastSpot(room))
  const faults = within(box(0, 0, width, height), toast)
    ? []
    : [`off screen at ${toast.left},${toast.top}`]
  for (const [control, area] of Object.entries(chromeButtons(width, height)))
    if (overlaps(toast, area)) faults.push(`covers the ${control}`)
  return faults
}

const sweepCases = GRID.flatMap(({ width, height }) =>
  states
    .filter(
      (state) =>
        state !== "open" ||
        width < DESKTOP_MIN_WIDTH ||
        height >= PANEL_FULL_SCREEN_BELOW_HEIGHT
    )
    .flatMap((state) =>
      toastKinds.map(([kind, toastHeight]) => ({
        name: `${kind} ${width}x${height} ${state}`,
        faults: () => chromeFaults(width, height, state, toastHeight),
      }))
    )
)

describe("toastSpot", () => {
  it("keeps every toast of the review grid on screen, off the bottom controls and headers, and at least the minimum width", () => {
    expect(grid).toHaveLength(16 * 10 * 3 * 2)
    expect(gridFaults(toastSpot)).toEqual([])
  })

  it("never covers the phone Menu button or the Coach dock button at any size of the browser sweep", () => {
    expect(sweepCases.length).toBeGreaterThan(50)
    expect(
      sweepCases.flatMap(({ name, faults }) =>
        faults().map((fault) => `${name}: ${fault}`)
      )
    ).toEqual([])
  })

  it("flags the corner the rule used to fall back to at 1280x117, on top of the Coach dock button", () => {
    const { room } = layout(1280, 117, "closed")
    const corner = toastBoxAt(room, { right: 24, width: 356, bottom: 24 })
    expect(
      overlaps(corner, chromeButtons(1280, 117)["Coach dock button"])
    ).toBe(true)
    expect(toastSpot(room).bottom).toBe(40 + TOAST_CLEARANCE_GAP_PX)
  })

  it("flags the top of the window that the rule used to fall back to at 768 wide with the panel open", () => {
    const short = layout(768, 657, "open")
    expect(
      placementFaults(short, {
        right: 24,
        width: 356,
        bottom: 657 - UNDO_TOAST_HEIGHT,
      })
    ).toEqual(
      expect.arrayContaining([
        "toast covers page header row",
        "toast covers Coach panel header row",
        "toast covers the Coach panel beside it",
      ])
    )
  })

  it("narrows the toast to the room left of the panel between 768 and 807 wide on short windows, above the sidebar Account button", () => {
    const { room } = layout(768, 657, "open")
    expect(toastSpot(room)).toEqual({
      right: 400 + 20 + TOAST_CLEARANCE_GAP_PX,
      bottom: 52 + TOAST_CLEARANCE_GAP_PX,
      width: 768 - 420 - TOAST_CLEARANCE_GAP_PX - 24,
    })
    expect(toastSpot(layout(807, 780, "open").room).width).toBe(355)
    expect(toastSpot(layout(808, 780, "open").room).width).toBe(356)
  })

  it("puts the toast inside a panel nearly as wide as the window, above its composer and below its header", () => {
    const width = 700
    const height = 600
    const panel = box(20, 8, 660, 544)
    const composer = box(32, 462, 636, 78)
    const room: ToastRoom = {
      viewport: { width, height },
      toast: { width: 356, height: UNDO_TOAST_HEIGHT },
      corner: 24,
      pageTop: 9,
      obstacles: [box(0, height - 40, width, 40), panel, composer],
    }
    const toast = toastBoxAt(room, toastSpot(room))
    expect(toast).toEqual(
      box(
        panel.left + panel.width - TOAST_CLEARANCE_GAP_PX - 356,
        composer.top - TOAST_CLEARANCE_GAP_PX - UNDO_TOAST_HEIGHT,
        356,
        UNDO_TOAST_HEIGHT
      )
    )
    expect(toast.top).toBeGreaterThanOrEqual(panel.top + UNDO_TOAST_HEIGHT)
  })

  it("never leaves a toast at the top of the window when nothing fits", () => {
    const room: ToastRoom = {
      viewport: { width: 400, height: 500 },
      toast: { width: 356, height: UNDO_TOAST_HEIGHT },
      corner: 24,
      pageTop: 9,
      obstacles: [box(0, 0, 400, 500)],
    }
    const toast = toastBoxAt(room, toastSpot(room))
    expect(toast.top).toBeGreaterThanOrEqual(room.pageTop + UNDO_TOAST_HEIGHT)
    expect(toast.top + toast.height).toBeLessThanOrEqual(500)
  })

  it.each([
    [768, 480, "open"],
    [768, 657, "open"],
    [800, 700, "open"],
    [1366, 657, "open"],
    [1280, 600, "open"],
    [1024, 568, "chat page"],
    [390, 568, "open"],
    [320, 480, "chat page"],
  ] as const)(
    "keeps a stack of three toasts on screen at %i x %i, panel %s, with the older two collapsed behind the front one",
    (width, height, state) => {
      const short = layout(width, height, state)
      const front = toastBoxAt(short.room, toastSpot(short.room))
      for (const count of [2, 3])
        expect(
          boxFaults(short, collapsedStack(front, count), `stack of ${count}`)
        ).toEqual([])
    }
  )

  it("fails the grid with the rule that lifted toasts above every obstacle", () => {
    const failing = gridFaults(liftAboveEveryObstacle)
    expect(failing).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^Undo 1366x657 open: /),
        expect.stringMatching(/^Undo 1440x700 open: /),
        expect.stringMatching(/^Undo 1280x600 open: /),
      ])
    )
  })

  it("keeps the placements that passed review on tall windows", () => {
    const top = (width: number, height: number, state: PanelState) => {
      const { room } = layout(width, height, state)
      return toastBoxAt(room, toastSpot(room)).top
    }
    expect(top(1440, 900, "closed")).toBe(794)
    expect(top(1440, 900, "open")).toBe(186)
    expect(top(390, 844, "closed")).toBe(730)
    expect(top(390, 844, "open")).toBe(668)
  })

  it("moves the toast beside the open panel when the panel leaves no room above it", () => {
    const { room } = layout(1366, 657, "open")
    expect(toastSpot(room)).toEqual({
      right: 400 + 20 + TOAST_CLEARANCE_GAP_PX,
      bottom: 40 + TOAST_CLEARANCE_GAP_PX,
      width: 356,
    })
  })

  it("ignores hidden obstacles", () => {
    const { room } = layout(390, 844, "closed")
    expect(
      toastSpot({ ...room, obstacles: [...room.obstacles, box(0, 0, 0, 0)] })
    ).toEqual(toastSpot(room))
  })
})

function obstacleAt(top: number, height: number) {
  const element = document.createElement("div")
  element.getBoundingClientRect = () =>
    ({ left: 0, top, width: 1024, height }) as DOMRect
  document.body.append(element)
  return element
}

const offset = (name: string) =>
  document.documentElement.style.getPropertyValue(name)

afterEach(() => {
  document.body.replaceChildren()
  document.documentElement.style.removeProperty(TOAST_OFFSET_BOTTOM)
  document.documentElement.style.removeProperty(TOAST_OFFSET_RIGHT)
})

function windowOf(width: number, height: number) {
  const root = document.documentElement
  Object.defineProperty(root, "clientWidth", {
    value: width,
    configurable: true,
  })
  Object.defineProperty(root, "clientHeight", {
    value: height,
    configurable: true,
  })
  return height
}

describe("keepToastsClearOf", () => {
  it("reports the dock, then a bar above it, then the dock again, then nothing", () => {
    const height = windowOf(1024, 768)
    const releaseDock = keepToastsClearOf(obstacleAt(height - 40, 40))
    expect(offset(TOAST_OFFSET_BOTTOM)).toBe(`${40 + TOAST_CLEARANCE_GAP_PX}px`)

    const releaseBar = keepToastsClearOf(obstacleAt(height - 140, 100))
    expect(offset(TOAST_OFFSET_BOTTOM)).toBe(
      `${140 + TOAST_CLEARANCE_GAP_PX}px`
    )

    releaseBar?.()
    expect(offset(TOAST_OFFSET_BOTTOM)).toBe(`${40 + TOAST_CLEARANCE_GAP_PX}px`)

    releaseDock?.()
    expect(offset(TOAST_OFFSET_BOTTOM)).toBe("")
    expect(offset(TOAST_OFFSET_RIGHT)).toBe("")
  })
})
