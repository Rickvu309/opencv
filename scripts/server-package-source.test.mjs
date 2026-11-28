import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { detect, serverPackages } from "./lib/server-package-source.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

const MISTAKE = JSON.stringify({
  name: "@workspace/paper-engine",
  type: "module",
  exports: {
    ".": {
      "opencv-source": "./src/index.ts",
      types: "./src/index.ts",
      import: "./src/index.ts",
    },
  },
})

const CLEAN = JSON.stringify({
  name: "@workspace/paper-engine",
  type: "module",
  exports: {
    ".": {
      "opencv-source": "./src/index.ts",
      types: "./dist/index.d.ts",
      import: "./dist/index.js",
    },
  },
})

const MAIN_SOURCE = JSON.stringify({
  name: "@workspace/old",
  main: "src/index.ts",
})

function workspacePackages() {
  return ["apps", "packages"].flatMap((group) =>
    readdirSync(path.join(root, group))
      .map((name) => `${group}/${name}/package.json`)
      .filter((file) => existsSync(path.join(root, file)))
      .map((file) => ({
        file,
        source: readFileSync(path.join(root, file), "utf8"),
      }))
      .map((entry) => ({ ...entry, pkg: JSON.parse(entry.source) }))
  )
}

test("a package that sends plain Node to TypeScript source fires", () => {
  assert.equal(detect(MISTAKE, "packages/paper-engine/package.json").length, 1)
  assert.equal(detect(MAIN_SOURCE, "packages/old/package.json").length, 1)
})

test("a package that keeps source under opencv-source and builds for import stays quiet", () => {
  assert.deepEqual(detect(CLEAN, "packages/paper-engine/package.json"), [])
})

test("the server's runtime packages come from its dependencies, not its dev tools", () => {
  const packages = [
    {
      pkg: {
        name: "api",
        dependencies: { a: "workspace:*" },
        devDependencies: { c: "workspace:*" },
      },
    },
    { pkg: { name: "a", dependencies: { b: "workspace:*" } } },
    { pkg: { name: "b" } },
    { pkg: { name: "c" } },
  ]
  assert.deepEqual(
    serverPackages(packages)
      .map((entry) => entry.pkg.name)
      .sort(),
    ["a", "b"]
  )
})

test("every package the built server loads points plain Node at built files", () => {
  const loaded = serverPackages(workspacePackages())
  assert.ok(
    loaded.some((entry) => entry.pkg.name === "@workspace/paper-engine")
  )
  assert.deepEqual(
    loaded.flatMap((entry) => detect(entry.source, entry.file)),
    []
  )
})
