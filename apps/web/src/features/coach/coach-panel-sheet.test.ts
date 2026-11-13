import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const css = readFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "coach-panel-sheet.css"
  ),
  "utf8"
)

function media(marker: string) {
  const start = css.indexOf(marker)
  const next = css.indexOf("@media", start + marker.length)
  return css.slice(start, next === -1 ? css.length : next)
}

describe("the Coach panel leaves the way it entered", () => {
  it("slides on the panel token and fades in place when motion is reduced", () => {
    const travel = media("prefers-reduced-motion: no-preference")
    expect(travel).toContain("transition-duration: var(--duration-panel)")
    expect(travel).toContain("transition-timing-function: var(--ease-panel)")
    expect(travel).toContain("transition-property: translate")
    expect(media("min-width: 48rem")).toContain("translate: 100% 0")
    expect(media("max-width: 47.99rem")).toContain("translate: 0 100%")
    const reduce = media("prefers-reduced-motion: reduce")
    expect(reduce).toContain("transition-property: opacity")
    expect(reduce).toContain("opacity: 0")
    expect(reduce).toContain("translate: 0 0")
    expect(reduce).not.toContain("100%")
    expect(css).not.toMatch(/\b\d+m?s\b/)
    expect(css).not.toMatch(
      /transition-property:[^;]*(width|height|padding|margin|top|left)/
    )
  })
})
