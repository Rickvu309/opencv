import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const modules = [
  "connections",
  "account",
  "chat",
  "paper",
  "job",
  "inbox",
  "coach",
]

function filesUnder(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === "eval") continue
      found.push(...filesUnder(full))
      continue
    }
    if (entry.endsWith(".ts")) found.push(full)
  }
  return found
}

describe("an import into another api module that skips its index.ts is rejected", () => {
  it("imports another product module only through index.ts", () => {
    const violations: string[] = []
    for (const file of filesUnder(srcRoot)) {
      const text = readFileSync(file, "utf8")
      const from = [...text.matchAll(/from "(\.\.?\/[^"]+)"/g)].map(
        (match) => match[1] ?? ""
      )
      for (const specifier of from) {
        const resolved = path.normalize(
          path.join(path.dirname(file), specifier)
        )
        const relative = path.relative(srcRoot, resolved)
        const [top, second] = relative.split(path.sep)
        if (!top || !modules.includes(top)) continue
        if (second === "index.js" || second === "index.ts") continue
        const owner = path.relative(srcRoot, file).split(path.sep)[0]
        if (owner === top) continue
        violations.push(`${path.relative(srcRoot, file)} -> ${relative}`)
      }
    }
    expect(
      violations,
      `Import another api module only through its index.ts (apps/api/src/<module>/index.ts); export what you need there. Offending imports:\n${violations.join("\n")}`
    ).toEqual([])
  })
})
