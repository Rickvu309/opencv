import { afterEach, describe, expect, it } from "vitest"

import { TOAST_OFFSET_BOTTOM } from "@workspace/ui/lib/toast-offset"
import {
  keepToastsClearOf,
  TOAST_CLEARANCE_GAP_PX,
  toastClearance,
} from "@/lib/toast-clearance.ts"

function obstacleAt(top: number, height: number) {
  const element = document.createElement("div")
  element.getBoundingClientRect = () => ({ top, height }) as DOMRect
  document.body.append(element)
  return element
}

const offset = () =>
  document.documentElement.style.getPropertyValue(TOAST_OFFSET_BOTTOM)

afterEach(() => {
  document.body.replaceChildren()
  document.documentElement.style.removeProperty(TOAST_OFFSET_BOTTOM)
})

describe("toastClearance", () => {
  it("lifts toasts above the highest shown obstacle plus the gap", () => {
    expect(
      toastClearance(900, [
        { top: 860, height: 40 },
        { top: 252, height: 600 },
      ])
    ).toBe(900 - 252 + TOAST_CLEARANCE_GAP_PX)
  })

  it("ignores hidden obstacles", () => {
    expect(
      toastClearance(844, [
        { top: 796, height: 48 },
        { top: 0, height: 0 },
      ])
    ).toBe(48 + TOAST_CLEARANCE_GAP_PX)
  })

  it("leaves the corner offset alone when nothing is shown", () => {
    expect(toastClearance(900, [{ top: 0, height: 0 }])).toBeNull()
  })
})

describe("keepToastsClearOf", () => {
  it("reports the dock, then the open panel, then the dock again when the panel closes", () => {
    const height = document.documentElement.clientHeight
    const releaseDock = keepToastsClearOf(obstacleAt(height - 40, 40))
    expect(offset()).toBe(`${40 + TOAST_CLEARANCE_GAP_PX}px`)

    const releasePanel = keepToastsClearOf(obstacleAt(height - 648, 600))
    expect(offset()).toBe(`${648 + TOAST_CLEARANCE_GAP_PX}px`)

    releasePanel?.()
    expect(offset()).toBe(`${40 + TOAST_CLEARANCE_GAP_PX}px`)

    releaseDock?.()
    expect(offset()).toBe("")
  })
})
