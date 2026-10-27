// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const landingDir = fileURLToPath(
  new URL("../features/landing", import.meta.url)
)
const owner = "features/landing/landing-button.ts"

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.tsx?$/.test(entry.name) ? [full] : []
  })
}

describe("marketing buttons", () => {
  it("builds every landing call to action with landingButton", () => {
    const violations: string[] = []
    for (const file of sourceFiles(landingDir)) {
      if (path.basename(file) === "landing-button.ts") continue
      const text = readFileSync(file, "utf8")
      const rel = path.relative(landingDir, file).replaceAll("\\", "/")
      if (/buttonVariants\s*\(/.test(text)) {
        violations.push(
          `${rel} calls buttonVariants(). Use landingButton() from ${owner}.`
        )
      }
      for (const tag of text.matchAll(/<(?:Link|a|button|Button)\b[^>]*>/g)) {
        if (/landing-(?:pill|gradient)/.test(tag[0])) {
          violations.push(
            `${rel} uses landing-pill or landing-gradient on a link or button. Use landingButton() from ${owner}.`
          )
        }
      }
    }
    expect(
      violations,
      `Use landingButton() from ${owner}.\n${violations.join("\n")}`
    ).toEqual([])
  })
})
