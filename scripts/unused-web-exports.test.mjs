import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"
import { unusedExports } from "./lib/unused-exports.mjs"

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)))
const file = (name, text) => ({ path: `apps/web/src/${name}`, text })
const paths = { "@/*": ["/apps/web/src/*"] }
const names = (files) => unusedExports(files, paths).map(({ name }) => name)

test("an unreferenced declaration inside an imported module fires", () => {
  assert.deepEqual(
    names([
      file("main.ts", 'import { used } from "./lib/value.ts"; used()'),
      file(
        "lib/value.ts",
        "export function used() {}\nexport function abandoned() {}"
      ),
    ]),
    ["abandoned"]
  )
})

test("resolved aliases, types, shorthand values, local uses and re-exports stay quiet", () => {
  assert.deepEqual(
    names([
      file(
        "main.ts",
        'import { value as renamed, type Shape } from "@/lib/value.ts"; const x: Shape = { renamed };'
      ),
      file(
        "lib/value.ts",
        "export const value = 1; export type Shape = { renamed: number }; export function local() {}; local(); export const forwarded = 2;"
      ),
      file("lib/barrel.ts", 'export { forwarded } from "./value.ts"'),
      file(
        "lib/shorthand.ts",
        "export const value = 2; const result = { value };"
      ),
    ]),
    []
  )
})

test("namespace and lazy imports preserve exports selected at runtime", () => {
  assert.deepEqual(
    names([
      file(
        "main.ts",
        'import * as values from "./lib/static.ts"; Object.values(values); const page = import("./lazy.tsx");'
      ),
      file("lib/static.ts", "export const reflected = 1"),
      file("lazy.tsx", "export function LazyPage() {}"),
    ]),
    []
  )
})

test("default exports and test declarations are outside the private named-export check", () => {
  assert.deepEqual(
    names([
      file("page.tsx", "export default function Page() {}"),
      file("value.test.ts", "export const fixture = 1"),
      file("value.fixtures.ts", "export const fixture = 2"),
      file("test/value.ts", "export const fixture = 3"),
      file("env.d.ts", "export type Environment = string"),
    ]),
    []
  )
})

test("web exports have references in product code or their existing tests", () => {
  const files = execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "--",
      "apps/web/src",
    ],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter((name) => /\.tsx?$/.test(name))
    .map((name) => ({
      path: name,
      text: readFileSync(path.join(root, name), "utf8"),
    }))
  assert.deepEqual(unusedExports(files, paths), [])
})
