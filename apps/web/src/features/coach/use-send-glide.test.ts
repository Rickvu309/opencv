import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { cubicBezierFrom, glideViewport } from "./use-send-glide.ts"

const PANEL = { duration: 280, easing: "cubic-bezier(0.32, 0.72, 0, 1)" }

let frames: FrameRequestCallback[] = []
let clock = 0

function runFrame(step = 40) {
  clock += step
  const due = frames
  frames = []
  due.forEach((callback) => callback(clock))
}

function viewportAt(scrollTop: number) {
  const element = document.createElement("div")
  element.scrollTop = scrollTop
  const native = vi.fn((options: ScrollToOptions) => {
    element.scrollTop = options.top ?? element.scrollTop
  })
  Object.defineProperty(element, "scrollTop", {
    configurable: true,
    writable: true,
    value: scrollTop,
  })
  Object.defineProperty(Object.getPrototypeOf(element), "scrollTo", {
    configurable: true,
    writable: true,
    value: native,
  })
  return { element, native }
}

beforeEach(() => {
  frames = []
  clock = 0
  vi.spyOn(performance, "now").mockImplementation(() => clock)
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    frames.push(callback)
  )
  vi.stubGlobal("cancelAnimationFrame", () => {
    frames = []
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("cubicBezierFrom", () => {
  it("reads the panel curve token and starts fast", () => {
    const ease = cubicBezierFrom(PANEL.easing)!
    expect(ease(0)).toBeCloseTo(0)
    expect(ease(1)).toBeCloseTo(1)
    expect(ease(0.25)).toBeGreaterThan(0.5)
  })

  it("gives up on anything that is not a cubic-bezier", () => {
    expect(cubicBezierFrom("ease")).toBeNull()
  })
})

describe("glideViewport", () => {
  it("eases to the newest pin target instead of jumping, then hands scrolling back", () => {
    const { element, native } = viewportAt(900)
    glideViewport(element, PANEL)
    element.scrollTo({ top: 1170, behavior: "auto" })
    element.scrollTo({ top: 1160, behavior: "auto" })
    expect(native).not.toHaveBeenCalled()
    expect(element.scrollTop).toBe(900)

    runFrame()
    const early = element.scrollTop
    expect(early).toBeGreaterThan(900)
    expect(early).toBeLessThan(1160)
    for (let frame = 0; frame < 10 && frames.length; frame++) runFrame()
    expect(element.scrollTop).toBe(1160)

    element.scrollTo({ top: 40 })
    expect(native).toHaveBeenCalledOnce()
  })

  it("stops where it is and hands scrolling back when the person uses the wheel", () => {
    const { element, native } = viewportAt(900)
    glideViewport(element, PANEL)
    element.scrollTo({ top: 1160 })
    runFrame()
    const reached = element.scrollTop
    element.dispatchEvent(new Event("wheel"))
    runFrame()
    expect(element.scrollTop).toBe(reached)
    expect(reached).toBeLessThan(1160)
    element.scrollTo({ top: 40 })
    expect(native).toHaveBeenCalledOnce()
  })
})
