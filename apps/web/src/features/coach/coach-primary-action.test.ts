import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

function productFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory())
      return entry.name === "test" ? [] : productFiles(full)
    if (!entry.name.endsWith(".tsx") || entry.name.endsWith(".test.tsx"))
      return []
    return [full]
  })
}

describe("coach primary action", () => {
  it("is set only by the Coach page, so every screen keeps one primary action", () => {
    const setters = productFiles(SRC)
      .filter((file) =>
        /<CoachWorkspace\b[^>]*\bprimaryAction\b/.test(
          readFileSync(file, "utf8")
        )
      )
      .map((file) => path.relative(SRC, file).split(path.sep).join("/"))
    expect(setters).toEqual(["routes/coach.tsx"])
  })
})
