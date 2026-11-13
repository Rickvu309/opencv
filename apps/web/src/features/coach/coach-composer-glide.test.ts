import { describe, expect, it } from "vitest"

import {
  COMPOSER_GLIDE_ATTRIBUTE,
  COMPOSER_GLIDE_DISTANCE,
  composerGlideDistance,
  startComposerGlide,
} from "./coach-composer-glide.ts"

function composerAt(top: number) {
  const element = document.createElement("div")
  element.getBoundingClientRect = () => new DOMRect(0, top, 720, 82)
  return element
}

describe("composer glide from the centre to the bottom", () => {
  it("measures how far the composer moved, ignoring sub-pixel jitter", () => {
    expect(composerGlideDistance(340, 780)).toBe(-440)
    expect(composerGlideDistance(780.4, 780)).toBe(0)
    expect(composerGlideDistance(300, 301)).toBe(0)
  })

  it("starts from where the composer was and clears itself when the motion ends", () => {
    const element = composerAt(780)
    expect(startComposerGlide(element, 340, false)).toBe(true)
    expect(element.hasAttribute(COMPOSER_GLIDE_ATTRIBUTE)).toBe(true)
    expect(element.style.getPropertyValue(COMPOSER_GLIDE_DISTANCE)).toBe(
      "-440px"
    )
    element.dispatchEvent(new Event("animationend"))
    expect(element.hasAttribute(COMPOSER_GLIDE_ATTRIBUTE)).toBe(false)
    expect(element.style.getPropertyValue(COMPOSER_GLIDE_DISTANCE)).toBe("")
  })

  it("does not move when the person asked for reduced motion or nothing moved", () => {
    const element = composerAt(780)
    expect(startComposerGlide(element, 340, true)).toBe(false)
    expect(startComposerGlide(composerAt(780), 780, false)).toBe(false)
    expect(element.hasAttribute(COMPOSER_GLIDE_ATTRIBUTE)).toBe(false)
  })
})
