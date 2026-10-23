// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const webRoot = fileURLToPath(new URL("../..", import.meta.url))
const distDir = path.join(webRoot, "dist")

function listCss(dir: string, acc: string[] = []) {
  if (!existsSync(dir)) return acc
  for (const name of readdirSync(dir)) {
    const next = path.join(dir, name)
    if (statSync(next).isDirectory()) listCss(next, acc)
    else if (name.endsWith(".css")) acc.push(next)
  }
  return acc
}

describe("kit classes survive the web production build", () => {
  const cssFiles = listCss(distDir)

  it.skipIf(cssFiles.length === 0)(
    "emits bg-primary from the absorbed kit button",
    () => {
      const css = cssFiles.map((file) => readFileSync(file, "utf8")).join("\n")
      expect(css).toMatch(/\.bg-primary\b/)
      expect(css).toMatch(/--primary:/)
    }
  )
})
