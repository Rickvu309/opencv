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

describe("shell chrome", () => {
  it("keeps HomeThread and the full store hook out of shell chrome", () => {
    for (const file of SHELL_FILES) {
      const src = readFileSync(path.join(here, file), "utf8")
      expect(src, file).not.toMatch(/HomeThread/)
      expect(src, file).not.toMatch(/useChatStore/)
    }
  })
})

function mainColumn(source: string) {
  const at = source.indexOf('id="app-main"')
  if (at < 0) return ""
  return source.slice(at, at + 400)
}

function coachCardMistakes(source: string, styles: string) {
  const frame = source.slice(
    source.indexOf("const panelFrame"),
    source.indexOf("const collapsedRail")
  )
  const dock = source.slice(source.indexOf("function ShellDock"))
  const column = mainColumn(source)
  const mistakes: string[] = []
  if (!frame.includes("w-[400px]") || !frame.includes("600px"))
    mistakes.push("desktop Coach is not the 400 by 600 card")
  if (!frame.includes("right-5") || !frame.includes("bottom-12"))
    mistakes.push("desktop Coach is not anchored over the page")
  if (/clamp\(\s*360px/.test(frame) || /clamp\(\s*360px/.test(styles))
    mistakes.push("desktop Coach uses a split column")
  if (!dock.includes('data-slot="dock-recent"'))
    mistakes.push("recent chats are missing from the dock")
  if (/coachPage\s*\?\s*null/.test(source))
    mistakes.push("the dock is removed on Coach")
  if (!column.includes("flex-1"))
    mistakes.push("main content does not fill the shell")
  if (/panelOpen|panel\.open|clamp\(\s*360px|w-\[400px\]/.test(column))
    mistakes.push("main content width follows the Coach card")
  return mistakes
}

describe("coach card geometry", () => {
  it("rejects a split pane and a dock without chat chips", () => {
    expect(
      coachCardMistakes(
        'const panelFrame = <div className="w-[clamp(360px,28vw,400px)]" />; const collapsedRail = false; function ShellDock() { return null } coachPage ? null : null id="app-main" className="h-full min-w-0 w-[400px]"',
        "grid-template-columns: clamp(360px, 28vw, 400px);"
      )
    ).toEqual([
      "desktop Coach is not the 400 by 600 card",
      "desktop Coach is not anchored over the page",
      "desktop Coach uses a split column",
      "recent chats are missing from the dock",
      "the dock is removed on Coach",
      "main content does not fill the shell",
      "main content width follows the Coach card",
    ])
  })

  it("accepts the floating 400 by 600 card and the chat chips", () => {
    expect(
      coachCardMistakes(
        'const panelFrame = <div className="fixed right-5 bottom-12 h-[min(600px,max(320px,calc(100dvh-56px)))] w-[400px]" />; const collapsedRail = false; function ShellDock() { return <div data-slot="dock-recent" /> } id="app-main" className="h-full min-w-0 flex-1"',
        ""
      )
    ).toEqual([])
  })

  it("keeps the shell on the designed card", () => {
    expect(
      coachCardMistakes(
        readFileSync(path.join(here, "app-shell.tsx"), "utf8"),
        readFileSync(path.join(here, "design/dock.pen.css"), "utf8")
      )
    ).toEqual([])
  })
})
