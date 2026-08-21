// @vitest-environment node
import { globSync, readFileSync } from "node:fs"
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

describe(".env.example", () => {
  it("documents every VITE_ variable the web app reads", () => {
    const envExample = readFileSync(path.join(repoRoot, ".env.example"), "utf8")
    const documented = new Set(envExample.match(/VITE_[A-Z0-9_]+/g) ?? [])

    const srcDir = path.join(webRoot, "src")
    const used = new Set(
      globSync("**/*.{ts,tsx}", { cwd: srcDir }).flatMap(
        (file) =>
          readFileSync(path.join(srcDir, file), "utf8").match(
            /import\.meta\.env\.(VITE_[A-Z0-9_]+)/g
          ) ?? []
      )
    )

    for (const reference of used) {
      expect(documented).toContain(reference.replace("import.meta.env.", ""))
    }
    expect(used.size).toBeGreaterThan(0)
  })
})
