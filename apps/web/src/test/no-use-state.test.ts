// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const srcDir = fileURLToPath(new URL("..", import.meta.url))

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.[cm]?[jt]sx?$/.test(entry.name) ? [full] : []
  })
}

describe("no useState", () => {
  it("keeps component state in useReducer or useEffectReducer", () => {
    const hits = sourceFiles(srcDir)
      .filter((file) => file !== fileURLToPath(import.meta.url))
      .filter((file) => /\buseState\b/.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(srcDir, file))
    expect(
      hits,
      "Use useReducer with a typed action union, or useEffectReducer from use-effect-reducer when a transition starts an effect. packages/ui is the shadcn kit and is not scanned."
    ).toEqual([])
  })
})
