import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"
import { unusedExports } from "./lib/unused-exports.mjs"

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)))
const file = (name, text) => ({ path: `apps/api/src/${name}`, text })

test("an unreferenced API export fires beside a handler imported through a js specifier", () => {
  assert.deepEqual(
    unusedExports([
      file("main.ts", 'import { read } from "./paper/store.js"; read()'),
      file(
        "paper/store.ts",
        "export function read() {}\nexport function abandoned() {}"
      ),
    ]).map(({ name }) => name),
    ["abandoned"]
  )
})

test("an API handler reached through its public entry point stays quiet", () => {
  assert.deepEqual(
    unusedExports([
      file(
        "main.ts",
        'import { read as handler } from "./paper/index.js"; handler()'
      ),
      file("paper/index.ts", 'export { read } from "./store.js"'),
      file("paper/store.ts", "export function read() {}"),
    ]),
    []
  )
})

test("API exports have references in product code or their existing tests", () => {
  const files = execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "--",
      "apps/api/src",
    ],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter((name) => /\.tsx?$/.test(name))
    .map((name) => ({
      path: name,
      text: readFileSync(path.join(root, name), "utf8"),
    }))
  assert.deepEqual(unusedExports(files), [])
})
