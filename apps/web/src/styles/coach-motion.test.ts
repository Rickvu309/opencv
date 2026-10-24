// @vitest-environment node
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const webRoot = fileURLToPath(new URL("..", import.meta.url))

function read(rel: string) {
  return readFileSync(path.join(webRoot, rel), "utf8")
}

describe("Coach motion tokens and reduced-motion", () => {
  it("uses Spec 6 duration tokens and disables enter motion under reduced-motion", () => {
    const css = read("styles/coach.css")
    expect(css).toContain("--duration-micro")
    expect(css).toContain("--duration-panel")
    expect(css).toContain("--ease-micro")
    expect(css).toContain(".coach-working-bar")
    expect(css).toContain(".coach-text-enter")
    expect(css).toContain(".coach-receipt-enter")
    expect(css).toContain(".coach-receipt-collapse")
    expect(css).toContain(".coach-float-card")
    expect(css).toContain(".coach-float-backdrop")
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/)
    expect(css).toMatch(
      /prefers-reduced-motion: reduce[\s\S]*\.coach-receipt-enter[\s\S]*animation:\s*none/
    )
    expect(css).toMatch(
      /prefers-reduced-motion: reduce[\s\S]*\.coach-float-card[\s\S]*transition:\s*none/
    )
    expect(css).toMatch(
      /prefers-reduced-motion: reduce[\s\S]*\[data-slot="aui-thread-viewport"\][\s\S]*animation:\s*none/
    )
  })

  it("keeps the S7.4 Paper highlight static under reduced-motion", () => {
    const css = read("styles/paper.css")
    expect(css).toContain("paper-coach-changed")
    expect(css).toContain("--duration-panel")
    expect(css).toMatch(
      /prefers-reduced-motion: reduce[\s\S]*\.paper-coach-changed[\s\S]*animation:\s*none/
    )
  })
})
