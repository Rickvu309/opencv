import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { shellCopy } from "@/features/app-shell/shell-copy.ts"
import { startPagePath } from "@/features/app-shell/start-page.ts"

describe("startPagePath", () => {
  it("maps the four start pages and sends anything else to Apply", () => {
    expect(startPagePath("apply")).toBe("/apply")
    expect(startPagePath("paper")).toBe("/paper")
    expect(startPagePath("inbox")).toBe("/inbox")
    expect(startPagePath("coach")).toBe("/coach")
    expect(startPagePath("home")).toBe("/apply")
    expect(startPagePath(undefined)).toBe("/apply")
    expect(startPagePath(null)).toBe("/apply")
  })
})

describe("shell copy", () => {
  it("matches copy.json", () => {
    const json = JSON.parse(
      readFileSync(
        path.resolve(process.cwd(), "src/features/app-shell/copy.json"),
        "utf8"
      )
    ) as Record<string, string>

    expect(json).toEqual({
      "shell.wordmark": shellCopy.wordmark,
      "shell.search": shellCopy.search,
      "shell.newChat": shellCopy.newChat,
      "shell.inbox": shellCopy.inbox,
      "shell.coach": shellCopy.coach,
      "shell.jobs": shellCopy.jobs,
      "shell.yourWork": shellCopy.yourWork,
      "shell.paper": shellCopy.paper,
      "shell.apply": shellCopy.apply,
      "shell.pitch": shellCopy.pitch,
      "shell.favorites": shellCopy.favorites,
      "shell.settings": shellCopy.settings,
      "shell.menu": shellCopy.menu,
      "shell.closeMenu": shellCopy.closeMenu,
      "shell.history": shellCopy.history,
      "shell.minimize": shellCopy.minimize,
      "shell.expand": shellCopy.expand,
      "shell.close": shellCopy.close,
    })
  })
})
