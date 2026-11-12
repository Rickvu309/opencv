import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const here = path.dirname(fileURLToPath(import.meta.url))

const SHELL_FILES = [
  "app-shell-layout.tsx",
  "app-shell.tsx",
  "nav-profile.tsx",
  "sidebar-nav.ts",
]

function detectCoachLayout(source: string, styles: string) {
  const frame = source.slice(
    source.indexOf("const panelFrame"),
    source.indexOf("const collapsedRail")
  )
  const violations: string[] = []
  if (
    /\babsolute\b/.test(frame) &&
    !/grid-template-columns:[^;]+clamp\(/.test(styles)
  )
    violations.push("Coach overlays the desktop page")
  if (/data-slot=["']dock-recent["']/.test(source))
    violations.push("Chat titles are in the dock")
  return violations
}

describe("shell chrome", () => {
  it("keeps HomeThread and the full store hook out of shell chrome", () => {
    for (const file of SHELL_FILES) {
      const src = readFileSync(path.join(here, file), "utf8")
      expect(src, file).not.toMatch(/HomeThread/)
      expect(src, file).not.toMatch(/useChatStore/)
    }
  })

  it("detects the floating panel and title-tab mistakes", () => {
    expect(
      detectCoachLayout(
        'const panelFrame = <div className="absolute" />; const collapsedRail = false; <div data-slot="dock-recent" />',
        ""
      )
    ).toEqual([
      "Coach overlays the desktop page",
      "Chat titles are in the dock",
    ])
  })

  it("accepts a split panel with a launcher and history", () => {
    expect(
      detectCoachLayout(
        'const panelFrame = <div data-slot="shell-coach" />; const collapsedRail = false;',
        "grid-template-columns: minmax(0, 1fr) clamp(360px, 28vw, 400px);"
      )
    ).toEqual([])
  })

  it("only animates the panel when the person allows motion", () => {
    const styles = readFileSync(path.join(here, "design/dock.pen.css"), "utf8")
    const [still, moving] = styles.split(
      "@media (prefers-reduced-motion: no-preference)"
    )
    expect(still).not.toMatch(/transition:/)
    expect(moving).toContain(
      "grid-template-columns var(--duration-panel) var(--ease-panel)"
    )
    expect(moving).toContain(
      "transform var(--duration-panel) var(--ease-panel)"
    )
    expect(moving).toContain('[data-open="false"]')
  })

  it("keeps Coach beside the page and chat titles out of the dock", () => {
    expect(
      detectCoachLayout(
        readFileSync(path.join(here, "app-shell.tsx"), "utf8"),
        readFileSync(path.join(here, "design/dock.pen.css"), "utf8")
      )
    ).toEqual([])
  })
})
