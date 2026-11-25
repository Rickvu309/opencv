import assert from "node:assert/strict"
import test from "node:test"
import { scalePaperPage } from "./paper-doc/paper-page-scale.js"

test("a narrow viewport scales both physical page dimensions equally", () => {
  assert.deepEqual(scalePaperPage(816, 1056, 408), {
    scale: 0.5,
    width: 408,
    height: 528,
  })
})

test("a wide viewport keeps the physical page size", () => {
  assert.deepEqual(scalePaperPage(816, 1056, 1440), {
    scale: 1,
    width: 816,
    height: 1056,
  })
})

test("an unmeasured viewport retains a positive page scale", () => {
  const geometry = scalePaperPage(816, 1056, 0)
  assert.equal(geometry.width, 1)
  assert.equal(geometry.height / geometry.width, 1056 / 816)
})
