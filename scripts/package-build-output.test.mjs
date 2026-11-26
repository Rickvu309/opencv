import assert from "node:assert/strict"
import { globSync, readFileSync } from "node:fs"
import test from "node:test"

import { detect } from "./lib/package-build-output.mjs"

const read = (name) =>
  readFileSync(new URL(`../${name}`, import.meta.url), "utf8")

const built = {
  hasPacks: () => true,
  read: (name) =>
    name.endsWith("package.json")
      ? JSON.stringify({ exports: { ".": { import: "./dist/index.js" } } })
      : null,
}

test("every built workspace package names its build output in tsconfig.json", () => {
  const configs = globSync("{apps,packages}/*/tsconfig.json", {
    cwd: new URL("..", import.meta.url).pathname,
  })
  assert.ok(configs.includes("packages/domain/tsconfig.json"))
  for (const file of configs)
    assert.deepEqual(detect(read(file), file), [], file)
})

test("a built package without outDir fires and one with it stays quiet", () => {
  const missing = JSON.stringify({ compilerOptions: { rootDir: "src" } })
  const named = JSON.stringify({ compilerOptions: { outDir: "dist" } })
  assert.equal(detect(missing, "packages/x/tsconfig.json", built).length, 1)
  assert.deepEqual(detect(named, "packages/x/tsconfig.json", built), [])
  assert.deepEqual(
    detect(missing, "packages/x/tsconfig.json", { ...built, read: () => null }),
    []
  )
  assert.deepEqual(
    detect(missing, "packages/x/tsconfig.json", {
      ...built,
      hasPacks: () => false,
    }),
    []
  )
})
