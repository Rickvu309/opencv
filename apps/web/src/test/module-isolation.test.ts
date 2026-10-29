// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs"
import { relative } from "node:path"
import { fileURLToPath } from "node:url"
import { expect, it } from "vitest"

it("isolates every file with module mocks from lazy route consumers", () => {
  const src = new URL("../", import.meta.url)
  const config = readFileSync(
    new URL("../../vitest.config.ts", import.meta.url),
    "utf8"
  )
  const isolated = config.match(/const ISOLATED_FILES = \[(.*?)\]/s)?.[1] ?? ""
  const missing = readdirSync(src, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.test\.tsx?$/.test(entry.name))
    .map((entry) => `${entry.parentPath}/${entry.name}`)
    .filter((file) => /\bvi\.mock\(/.test(readFileSync(file, "utf8")))
    .map((file) => `src/${relative(fileURLToPath(src), file)}`)
    .filter((file) => !isolated.includes(`"${file}"`))
  expect(
    missing,
    "Add module-mocking suites to ISOLATED_FILES in vitest.config.ts"
  ).toEqual([])
})
