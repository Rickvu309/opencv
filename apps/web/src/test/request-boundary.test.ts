// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const srcDir = fileURLToPath(new URL("..", import.meta.url))
const libDir = path.join(srcDir, "lib")

const FORBIDDEN: { name: string; pattern: RegExp }[] = [
  { name: "fetch(", pattern: /(?<!\w)fetch\(/ },
  { name: '"/api/" path', pattern: /\/api\// },
  { name: "queryKey: [", pattern: /queryKey:\s*\[/ },
  { name: "invalidateQueries", pattern: /invalidateQueries/ },
  {
    name: "key array definition",
    pattern: /\b(?:const|let|var)\s+\w*[kK]eys?\s*=\s*[[{]/,
  },
  {
    name: "cache call with a literal key",
    pattern:
      /(?:setQueryData|getQueryData|cancelQueries|removeQueries|setQueriesData|getQueriesData)\(\s*\[/,
  },
]

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory())
      return entry.name === "test" ? [] : sourceFiles(full)
    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) {
      return []
    }
    return [full]
  })
}

describe("an API path, fetch or query invalidation outside apps/web/src/lib is rejected", () => {
  it("keeps API paths, fetch and query invalidation inside lib/", () => {
    const hits: string[] = []
    for (const file of sourceFiles(srcDir)) {
      if (file.startsWith(libDir + path.sep)) continue
      const text = readFileSync(file, "utf8")
      for (const { name, pattern } of FORBIDDEN) {
        if (pattern.test(text))
          hits.push(`${path.relative(srcDir, file)}: ${name}`)
      }
    }
    expect(hits).toEqual([])
  })
})
