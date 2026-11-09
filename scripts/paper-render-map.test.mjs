import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { detect } from "./lib/paper-render-map.mjs"

const listed = `t_${"a".repeat(64)}`
const foreign = `t_${"b".repeat(64)}`
const clean = `const map = { targets: ["${listed}"] }\nconst entry = { targetId: "${listed}", reason: "greeting" }\n`
const withOffset = `const map = { targets: ["${listed}"] }\nconst entry = { targetId: "${listed}", offset: 4 }\n`
const withForeign = `const map = { targets: ["${listed}"] }\nconst entry = { targetId: "${foreign}" }\n`

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

test("the clean fixture emits neither an offset nor a foreign target", () => {
  assert.deepEqual(detect(clean, "fixture"), [])
})

test("the mistake fixture emits an offset or a target that is not in the map", () => {
  assert.ok(
    detect(withOffset, "fixture").some((item) => item.detail === "offset")
  )
  assert.ok(
    detect(withForeign, "fixture").some(
      (item) => item.detail === "foreign-target"
    )
  )
  assert.deepEqual(detect(withOffset, "other.ts"), [])
})

test("the map sources stay quiet", () => {
  for (const path of [
    "apps/api/src/paper/package-render-map.ts",
    "apps/api/src/paper/package-diagnostics.ts",
  ]) {
    assert.deepEqual(detect(read(path), path), [])
  }
})
