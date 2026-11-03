// @vitest-environment node
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const css = readFileSync(new URL("./app-shell.css", import.meta.url), "utf8")

describe("figure motion rules", () => {
  it("demo-only .oc-ghost nodes are hidden under .oc-static and prefers-reduced-motion", () => {
    expect(css).toMatch(/\.oc-static \.oc-ghost\s*\{\s*opacity: 0 !important/)
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[^@]*\.oc-root \.oc-ghost\s*\{\s*opacity: 0 !important/
    )
  })
})
