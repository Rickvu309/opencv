import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect } from "./lib/shot-capacity.mjs"

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8")

test("screenshot commands route uploads through release capacity allocation", () => {
  assert.deepEqual(detect(read("./fixtures/shot-capacity/mistake.txt")), [
    "Screenshot uploads bypass release capacity allocation",
  ])
  assert.deepEqual(detect(read("./fixtures/shot-capacity/clean.txt")), [])
  assert.deepEqual(detect(read("./ocv-tools/shot.mjs")), [])
})
