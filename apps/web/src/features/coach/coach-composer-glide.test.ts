import { afterEach, describe, expect, it, vi } from "vitest"

import {
  composerGlideDistance,
  panelMotionToken,
  startComposerGlide,
} from "./coach-composer-glide.ts"

function composerAt(top: number) {
  const element = document.createElement("div")
  element.getBoundingClientRect = () => new DOMRect(0, top, 720, 82)
  element.animate = vi.fn(() => ({}) as Animation)
  document.body.append(element)
  const root = document.documentElement.style
  for (const name of ["--duration-panel", "--ease-panel"])
    if (root.getPropertyValue(name))
      element.style.setProperty(name, root.getPropertyValue(name))
  return element
}

afterEach(() => {
  document.body.replaceChildren()
  document.documentElement.style.removeProperty("--duration-panel")
  document.documentElement.style.removeProperty("--ease-panel")
})

function setPanelToken() {
  document.documentElement.style.setProperty("--duration-panel", "280ms")
  document.documentElement.style.setProperty(
    "--ease-panel",
    "cubic-bezier(0.32, 0.72, 0, 1)"
  )
}

describe("composer glide from the centre to the bottom", () => {
  it("measures how far the composer moved, ignoring sub-pixel jitter", () => {
    expect(composerGlideDistance(340, 780)).toBe(-440)
    expect(composerGlideDistance(780.4, 780)).toBe(0)
    expect(composerGlideDistance(300, 301)).toBe(0)
  })

  it("moves only transform, from where the composer was, on the panel token", () => {
    setPanelToken()
    const element = composerAt(780)
    startComposerGlide(element, 340, false)
    expect(element.animate).toHaveBeenCalledWith(
      [{ transform: "translateY(-440px)" }, { transform: "translateY(0)" }],
      { duration: 280, easing: "cubic-bezier(0.32, 0.72, 0, 1)" }
    )
  })

  it("does not move under reduced motion, when nothing moved, or without the token", () => {
    setPanelToken()
    const reduced = composerAt(780)
    expect(startComposerGlide(reduced, 340, true)).toBeNull()
    const still = composerAt(780)
    expect(startComposerGlide(still, 780, false)).toBeNull()
    expect(reduced.animate).not.toHaveBeenCalled()
    expect(still.animate).not.toHaveBeenCalled()
    document.documentElement.style.removeProperty("--ease-panel")
    expect(panelMotionToken(composerAt(0))).toBeNull()
  })
})
