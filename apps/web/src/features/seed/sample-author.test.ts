import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

const PAPER_DEFAULTS_PENDING_916 = ["features/paper/cv-templates/cv-types.ts"]

function productFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory())
      return entry.name === "test" ? [] : productFiles(full)
    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name))
      return []
    return [full]
  })
}

describe("sample author", () => {
  it("is a fixture, never the user's identity: Settings and Pitch read the session User, so no product file outside the #916 paper defaults imports it", () => {
    const importers = productFiles(SRC)
      .filter((file) => !file.includes(`${path.sep}seed${path.sep}`))
      .filter((file) => /seed\/sample-author/.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(SRC, file).split(path.sep).join("/"))
      .sort()
    expect(importers).toEqual(PAPER_DEFAULTS_PENDING_916)
  })
})
