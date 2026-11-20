import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

const directory = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(join(directory, "shell-navigation.css"), "utf8")

const sidebar = readFileSync(join(directory, "design/app-sidebar.css"), "utf8")
const tokens = readFileSync(
  join(directory, "../../../../../packages/ui/src/styles/globals.css"),
  "utf8"
)

function luminance(name: string): number {
  const hex = tokens.match(new RegExp(`--${name}: #([0-9a-f]{6});`))?.[1]
  if (!hex) throw new Error(`Expected a hex color for --${name}`)
  const [red, green, blue] = [0, 2, 4].map((offset) => {
    const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!
}

describe("Your work contrast", () => {
  it("uses the muted foreground and keeps 4.5:1 contrast on sidebar surfaces", () => {
    expect(sidebar).toMatch(
      /\[data-slot="sidebar-group-label"\] \{\s+color: var\(--muted-foreground\);/
    )
    expect(tokens).toMatch(/--sidebar-accent: var\(--accent\);/)
    for (const surface of ["sidebar", "accent"]) {
      const [high, low] = [
        luminance("muted-foreground"),
        luminance(surface),
      ].sort((a, b) => b - a)
      expect((high! + 0.05) / (low! + 0.05)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("does not pad or position another feature's header", () => {
    expect(css).not.toMatch(
      /page-header|writing-document-header|paper-library-header|letter-start-header|letter-drafting-header|cv-editor-header|letter-editor-header|sidebar-expand|padding-inline-start/
    )
  })
})
