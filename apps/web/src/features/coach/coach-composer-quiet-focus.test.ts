import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const here = path.dirname(fileURLToPath(import.meta.url))
const designDir = path.join(here, "design")

function composerFocusGlows(css: string): string[] {
  const rules = css.matchAll(/([^{}]+)\{([^{}]*)\}/g)
  const glows: string[] = []
  for (const [, selector, body] of rules) {
    const target = selector.replace(/\s+/g, " ").trim()
    if (!target.includes("coach-composer")) continue
    if (!/:focus(-within|-visible)?\b/.test(target)) continue
    if (!/\b(box-shadow|border-color|outline)\s*:/.test(body)) continue
    glows.push(target)
  }
  return glows
}

const glowingRule = `[data-pen-surface="coach"][data-slot="coach-composer"]:not(
    [data-capped]
  ):focus-within {
  border-color: var(--ring);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--ring) 25%, transparent);
}`

const quietRule = `[data-pen-surface="coach"][data-slot="coach-composer"]:not([data-capped]) {
  border-radius: 10px;
  box-shadow: 0 1px 2px color-mix(in oklab, var(--foreground) 4%, transparent);
}

[data-pen-surface="coach"][data-slot="coach-composer"] textarea::placeholder {
  color: var(--muted-foreground);
}`

describe("Coach composer focus", () => {
  it("finds a focus rule that rings or recolors the composer", () => {
    expect(composerFocusGlows(glowingRule)).toHaveLength(1)
  })

  it("stays quiet on the resting composer rules", () => {
    expect(composerFocusGlows(quietRule)).toEqual([])
  })

  it("draws no glow around the composer when a person clicks into it", () => {
    const sheets = readdirSync(designDir).filter((name) =>
      name.endsWith(".pen.css")
    )
    expect(sheets.length).toBeGreaterThan(0)
    for (const sheet of sheets) {
      const css = readFileSync(path.join(designDir, sheet), "utf8")
      expect({ sheet, glows: composerFocusGlows(css) }).toEqual({
        sheet,
        glows: [],
      })
    }
  })
})
