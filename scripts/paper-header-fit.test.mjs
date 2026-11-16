import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect } from "./lib/paper-header-fit.mjs"

const path = "apps/web/src/features/paper/design/rich-page-header.pen.css"
const clean = readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

test("Paper 320px header keeps title shrinkage and one-line truncation", () => {
  assert.deepEqual(detect(clean, path), [])
  for (const mistake of [
    clean.replace("flex-basis: 0;", "flex-basis: 12rem;"),
    clean.replace("white-space: nowrap;", "white-space: normal;"),
  ]) {
    assert.notEqual(mistake, clean)
    assert.equal(detect(mistake, path).length, 1)
  }
  assert.deepEqual(detect("", "another.css"), [])
})

test("Paper header guard catches the introducing 1577 stylesheet", () => {
  const before = execFileSync("git", ["show", `7f4a5597:${path}`], {
    encoding: "utf8",
  })
  assert.equal(detect(before, path).length, 1)
  assert.deepEqual(detect(clean, path), [])
})
