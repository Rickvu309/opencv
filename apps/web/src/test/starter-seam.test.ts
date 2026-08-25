// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const webRoot = fileURLToPath(new URL("../..", import.meta.url))
const srcDir = path.join(webRoot, "src")

function productionSourceFiles(dir: string) {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.tsx?$/.test(file) && !file.includes(".test."))
    .map((file) => path.join(dir, file))
}

describe("production seed removal", () => {
  it("keeps Paper, Apply, and Home free of client-side seed arrays", () => {
    const surfaces = [
      path.join(srcDir, "features/paper"),
      path.join(srcDir, "features/apply"),
      path.join(srcDir, "features/home"),
    ]

    for (const dir of surfaces) {
      for (const file of productionSourceFiles(dir)) {
        const source = readFileSync(file, "utf8")
        expect(source).not.toMatch(/samplePaperDocs|sampleApplyCards|SEED_CARDS/)
        expect(source).not.toMatch(/Eric Nguyen/)
        expect(file).not.toMatch(/seed-/)
      }
    }
  })

  it("does not load a client seed module on Paper or Apply", () => {
    const paper = readFileSync(
      path.join(srcDir, "features/paper/paper-workspace.tsx"),
      "utf8"
    )
    const apply = readFileSync(
      path.join(srcDir, "features/apply/apply-workspace.tsx"),
      "utf8"
    )

    expect(paper).not.toMatch(/features\/seed/)
    expect(apply).not.toMatch(/features\/seed/)
  })
})
