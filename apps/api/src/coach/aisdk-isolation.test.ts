import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

const coachDir = fileURLToPath(new URL(".", import.meta.url))
const repoRoot = join(coachDir, "../../../..")
const allowed = new Set(["apps/api/src/coach/runtime.ts"])
const importPattern =
  /from\s+["'](ai|ai\/[^"']+|@openrouter\/ai-sdk-provider|@openrouter\/ai-sdk-provider\/[^"']+|@ai-sdk\/[^"']+)["']/

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") continue
    const path = join(dir, entry)
    const stats = statSync(path)
    if (stats.isDirectory()) {
      walk(path, files)
      continue
    }
    if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      files.push(path)
    }
  }
  return files
}

describe("AI SDK isolation", () => {
  it("only the runtime module imports the AI SDK", () => {
    const offenders = [...walk(join(repoRoot, "apps")), ...walk(join(repoRoot, "packages"))]
      .map((file) => relative(repoRoot, file))
      .filter((rel) => !allowed.has(rel))
      .filter((rel) => importPattern.test(readFileSync(join(repoRoot, rel), "utf8")))

    expect(offenders).toEqual([])
  })
})
