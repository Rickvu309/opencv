// @vitest-environment node
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { resolveConfig } from "vite"

const webRoot = fileURLToPath(new URL("../..", import.meta.url))
const repoRoot = path.resolve(webRoot, "../..")

describe("vercel.json", () => {
  it("points outputDirectory at the directory Vite actually builds into", async () => {
    const { outputDirectory } = JSON.parse(
      readFileSync(path.join(repoRoot, "vercel.json"), "utf8")
    )
    const vite = await resolveConfig({ root: webRoot }, "build")

    expect(path.relative(repoRoot, vite.build.outDir)).toBe(outputDirectory)
  })
})
