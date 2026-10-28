import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const here = path.dirname(fileURLToPath(import.meta.url))

const SHELL_FILES = [
  "app-shell-layout.tsx",
  "app-shell.tsx",
  "nav-profile.tsx",
  "search-chats.ts",
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
