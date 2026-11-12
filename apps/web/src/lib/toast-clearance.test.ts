import { afterEach, describe, expect, it } from "vitest"

import {
  TOAST_OFFSET_BOTTOM,
  TOAST_OFFSET_RIGHT,
} from "@workspace/ui/lib/toast-offset"
import {
  keepToastsClearOf,
  TOAST_CLEARANCE_GAP_PX,
  toastBoxAt,
  toastSpot,
  type ToastBox,
  type ToastRoom,
  type ToastSpot,
} from "@/lib/toast-clearance.ts"

const UNDO_TOAST_HEIGHT = 58
const DESKTOP_FRAME = { left: 245, top: 9 }
const PHONE_FRAME = { left: 0, top: 48 }

type PanelState = "closed" | "open" | "chat page"

type Layout = {
  room: ToastRoom
  controls: Record<string, ToastBox>
}

const box = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  width,
  height,
})

function layout(width: number, height: number, state: PanelState): Layout {
  const phone = width <= 600
  const frame = phone ? PHONE_FRAME : DESKTOP_FRAME
  const dock = phone
    ? box(0, height - 48, width, 48)
    : box(frame.left, height - 40, width - frame.left, 40)
  const panelHeight = Math.min(600, Math.max(320, height - 56))
  const panel = box(width - 420, height - 48 - panelHeight, 400, panelHeight)
  const phoneComposer = box(12, height - 110, width - 24, 62)
  const chatComposer = phone
    ? box(12, height - 168, width - 24, 120)
    : box(frame.left + (width - frame.left - 720) / 2, height - 155, 720, 107)
  const obstacles =
    state === "closed"
      ? [dock]
      : state === "chat page"
        ? [dock, chatComposer]
        : phone
          ? [dock, phoneComposer]
          : [dock, panel]
  const composer =
    state === "chat page"
      ? chatComposer
      : phone
        ? phoneComposer
        : box(panel.left + 12, panel.top + panel.height - 90, 376, 78)
  const send = box(
    composer.left + composer.width - 40,
    composer.top + composer.height - 40,
    32,
    32
  )
  const controls = phone
    ? {
        "New on Paper home": box(width - 69, 64, 53, 44),
        "Download Word": box(width - 144, 46, 128, 44),
        "New job": box(width - 106, 52, 90, 44),
        "New chat": box(12, 52, 92, 44),
      }
    : {
        "New on Paper home": box(width - 78, 19, 53, 32),
        "Download Word": box(width - 153, 13, 128, 32),
        "New job": box(width - 115, 21, 90, 28),
        "New chat": box(frame.left + 12, 21, 92, 28),
      }
  return {
    room: {
      viewport: { width, height },
      toast: {
        width: phone ? width - 32 : 356,
        height: UNDO_TOAST_HEIGHT,
      },
      corner: phone ? 16 : 24,
      pageTop: frame.top,
      obstacles,
    },
    controls:
      state === "closed" ? controls : { ...controls, composer, Send: send },
  }
}

function placementFaults({ room, controls }: Layout, spot: ToastSpot) {
  const toast = toastBoxAt(room, spot)
  const faults: string[] = []
  if (
    toast.left < 0 ||
    toast.top < 0 ||
    toast.left + toast.width > room.viewport.width ||
    toast.top + toast.height > room.viewport.height
  )
    faults.push(`off screen at ${toast.left},${toast.top}`)
  for (const [name, control] of Object.entries(controls)) {
    if (
      toast.left < control.left + control.width &&
      control.left < toast.left + toast.width &&
      toast.top < control.top + control.height &&
      control.top < toast.top + toast.height
    )
      faults.push(`covers ${name}`)
  }
  return faults
}

function liftAboveEveryObstacle(room: ToastRoom): ToastSpot {
  return {
    right: room.corner,
    bottom:
      Math.max(
        ...room.obstacles.map((obstacle) => room.viewport.height - obstacle.top)
      ) + TOAST_CLEARANCE_GAP_PX,
  }
}

const windows: [number, number][] = [
  [1366, 657],
  [1440, 700],
  [1280, 600],
  [1024, 768],
  [1440, 900],
  [390, 844],
  [390, 600],
]
const states: PanelState[] = ["closed", "open", "chat page"]
const table = windows.flatMap(([width, height]) =>
  states.map((state) => ({ width, height, state }))
)

describe("toastSpot", () => {
  it.each(table)(
    "keeps the toast on screen and off every primary control at $width x $height, panel $state",
    ({ width, height, state }) => {
      const room = layout(width, height, state)
      expect(placementFaults(room, toastSpot(room.room))).toEqual([])
    }
  )

  it("fails the table with the rule that lifted toasts above every obstacle", () => {
    const failing = table
      .map(({ width, height, state }) => {
        const room = layout(width, height, state)
        const faults = placementFaults(room, liftAboveEveryObstacle(room.room))
        return faults.length ? `${width}x${height} ${state}` : null
      })
      .filter(Boolean)
    expect(failing).toEqual(
      expect.arrayContaining([
        "1366x657 open",
        "1440x700 open",
        "1280x600 open",
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
