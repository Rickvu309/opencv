import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect } from "./lib/paper-toolbar-overflow.mjs"

const toolbar = "apps/web/src/features/paper/rich-text-formatting.tsx"
const measurement = "apps/web/src/features/paper/rich-text-toolbar-overflow.ts"
const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

test("Paper keeps history and More visible by moving emphasis with measured width", () => {
  const clean = read(toolbar)
  assert.deepEqual(detect(clean, toolbar), [])
  for (const token of [
    "useToolbarEmphasisOverflow(host, compact)",
    "{!emphasisOverflow ? (",
    "{emphasisOverflow ? (",
  ]) {
    const mistake = clean.replace(token, "missing")
    assert.notEqual(mistake, clean)
    assert.equal(detect(mistake, toolbar).length, 1)
  }
  const before = execFileSync("git", ["show", `31528653:${toolbar}`], {
    encoding: "utf8",
  })
  assert.equal(detect(before, toolbar).length, 1)
})

test("Paper overflow counts actual child widths and CSS gaps without a phone breakpoint", () => {
  const clean = read(measurement)
  assert.deepEqual(detect(clean, measurement), [])
  for (const token of [
    "entry.contentRect.width",
    "child.getBoundingClientRect().width",
    "getComputedStyle(row).columnGap",
    "required > width",
  ]) {
    const mistake = clean.replace(token, "320")
    assert.notEqual(mistake, clean)
    assert.equal(detect(mistake, measurement).length, 1)
  }
  assert.deepEqual(detect("unrelated", "unrelated.ts"), [])
})
