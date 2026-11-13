import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  leaveKeyframes,
  motionLeave,
  motionToken,
  prefersReducedMotion,
  travelToken,
} from "./motion"

function askForLessMotion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reduce && query === "(prefers-reduced-motion: reduce)",
      media: query,
    }))
  )
}

beforeEach(() => {
  const root = document.documentElement.style
  root.setProperty("--duration-micro", "150ms")
  root.setProperty("--ease-micro", "cubic-bezier(0.22, 1, 0.36, 1)")
  root.setProperty("--duration-panel", "280ms")
  root.setProperty("--ease-panel", "cubic-bezier(0.32, 0.72, 0, 1)")
  root.setProperty("--motion-enter-scale", "0.97")
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute("style")
})

describe("motion tokens in script", () => {
  it("reads each timing from the CSS tokens", () => {
    askForLessMotion(false)
    expect(motionToken("panel")).toEqual({
      duration: 280,
      easing: "cubic-bezier(0.32, 0.72, 0, 1)",
    })
    expect(motionToken("micro")).toEqual({
      duration: 150,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    })
  })

  it("reads a token written in seconds as milliseconds", () => {
    document.documentElement.style.setProperty("--duration-panel", "0.28s")
    expect(motionToken("panel").duration).toBe(280)
  })

  it("does not animate when the tokens are missing", () => {
    document.documentElement.removeAttribute("style")
    expect(motionToken("micro").duration).toBe(0)
  })

  it("knows when a person asks for less motion", () => {
    askForLessMotion(true)
    expect(prefersReducedMotion()).toBe(true)
    askForLessMotion(false)
    expect(prefersReducedMotion()).toBe(false)
  })

  it("drops travel under reduced motion and keeps it otherwise", () => {
    askForLessMotion(false)
    expect(travelToken("panel").duration).toBe(280)
    askForLessMotion(true)
    expect(travelToken("panel")).toEqual({
      duration: 0,
      easing: "cubic-bezier(0.32, 0.72, 0, 1)",
    })
  })
})

describe("a list item leaving", () => {
  it("fades and shrinks to the enter scale", () => {
    askForLessMotion(false)
    expect(leaveKeyframes()).toEqual([
      { opacity: 1, scale: "1" },
      { opacity: 0, scale: "0.97" },
    ])
  })

  it("only fades when a person asks for less motion", () => {
    askForLessMotion(true)
    expect(leaveKeyframes()).toEqual([{ opacity: 1 }, { opacity: 0 }])
  })

  it("runs on the micro token through the Web Animations API and settles", async () => {
    askForLessMotion(false)
    const element = document.createElement("li")
    const animate = vi.fn(() => ({ finished: Promise.resolve() }))
    Object.assign(element, { animate })
    await expect(motionLeave(element)).resolves.toBeUndefined()
    expect(animate).toHaveBeenCalledWith(leaveKeyframes(), {
      duration: 150,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "forwards",
    })
  })

  it("settles when the leave is interrupted", async () => {
    askForLessMotion(false)
    const element = document.createElement("li")
    Object.assign(element, {
      animate: () => ({
        finished: Promise.reject(new DOMException("cancelled", "AbortError")),
      }),
    })
    await expect(motionLeave(element)).resolves.toBeUndefined()
  })
})
