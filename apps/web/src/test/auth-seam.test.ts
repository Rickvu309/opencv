// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const webRoot = fileURLToPath(new URL("../..", import.meta.url))
const srcDir = path.join(webRoot, "src")

function productionSourceFiles() {
  return readdirSync(srcDir, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.tsx?$/.test(file) && !file.includes(".test."))
    .filter((file) => !file.startsWith("test/"))
    .map((file) => path.join(srcDir, file))
}

describe("dev-profile removal", () => {
  it("deletes the placeholder module and env vars", () => {
    expect(
      existsSync(path.join(srcDir, "features/app-shell/dev-profile.ts"))
    ).toBe(false)

    for (const file of productionSourceFiles()) {
      const source = readFileSync(file, "utf8")
      expect(source).not.toMatch(/VITE_DEV_PROFILE_/)
      expect(source).not.toMatch(/getDevProfile/)
      expect(file).not.toMatch(/dev-profile/)
    }
  })
})
