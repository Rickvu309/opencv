import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen } from "@testing-library/react"

import { renderApp } from "@/test/render-app.tsx"

import pitchLayout from "./design/pitch.layout.json"
import proofLayout from "./design/proof.layout.json"

// Positions and styles are checked in a browser by verify:pen-layout. This
// keeps every pen text on its route, so the browser check can find each one.
beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const normalize = (text: string) => text.replaceAll(/\s+/g, " ").trim()

describe.each([pitchLayout, proofLayout])(
  "$frameName ($frameId) on $route",
  (layout) => {
    it("renders every pen text", async () => {
      renderApp(layout.route)
      await screen.findByRole("heading", { level: 2 })
      const page = normalize(document.body.textContent ?? "")
      const missing = layout.texts
        .map((entry) => entry.text)
        .filter((text) => !page.includes(text))
      expect(missing).toEqual([])
    })
  }
)
