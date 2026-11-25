// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs"
import { relative } from "node:path"
import { fileURLToPath } from "node:url"
import { expect, it } from "vitest"

it("isolates files whose first load or module mocks need a fresh import graph, so a shared graph cannot bind lazy route consumers to a mocked router", () => {
  const src = new URL("../", import.meta.url)
  const missing = readdirSync(src, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.test\.tsx?$/.test(entry.name))
    .filter((entry) => !/\.isolated\.test\.tsx?$/.test(entry.name))
    .map((entry) => `${entry.parentPath}/${entry.name}`)
    .filter((file) => /\bvi\.mock\(/.test(readFileSync(file, "utf8")))
    .map((file) => `src/${relative(fileURLToPath(src), file)}`)
  expect(
    missing,
    "Name module-mocking suites *.isolated.test.ts(x) so they run in the isolated project"
  ).toEqual([])
})

it("isolates by file name, with no hand list of isolated files", () => {
  const config = readFileSync(
    new URL("../../vitest.config.ts", import.meta.url),
    "utf8"
  )
  expect(config).toContain(
    'const ISOLATED_FILES = ["**/*.isolated.test.{ts,tsx}"]'
  )
})

it("uses Vitest 5 maxWorkers as the pool size, because poolOptions was removed", () => {
  const config = readFileSync(
    new URL("../../vitest.config.ts", import.meta.url),
    "utf8"
  )
  expect(config).toContain("const VITEST_5_POOL_SIZE")
  expect(config).toContain("maxWorkers: VITEST_5_POOL_SIZE")
  expect(config).not.toContain("poolOptions")
})
