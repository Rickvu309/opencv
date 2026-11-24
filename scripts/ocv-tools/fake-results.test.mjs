import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { detect } from "../lib/shared-fake-results.mjs"
import { fixture } from "./jobs/fixture.mjs"

const source = new URL("./ports/fake.mjs", import.meta.url)

test("fake result directories belong to each fixture", () => {
  assert.deepEqual(detect(readFileSync(source, "utf8")), [])
})

test("a shared literal result directory fires and a unique directory stays quiet", () => {
  assert.deepEqual(
    detect('PR_RESULT_DIR: world.resultDir ?? "/tmp/opencv-fake-results",'),
    [1]
  )
  assert.deepEqual(
    detect('PR_RESULT_DIR: world.resultDir ?? join(tmpdir(), "results"),'),
    [1]
  )
  assert.deepEqual(
    detect('PR_RESULT_DIR: world.resultDir ?? makeTempDir("results-"),'),
    []
  )
})

test("a completed merge cannot replace another fixture's pending receipt", () => {
  const queued = fixture({ mergeLater: true })
  assert.equal(queued.call("merge", "91").code, 0)
  const completed = fixture()
  assert.equal(completed.call("merge", "91").code, 0)
  const receipt = (f) =>
    JSON.parse(
      readFileSync(
        join(f.ctx.env.PR_RESULT_DIR, "opencv-merge-pr-91.json"),
        "utf8"
      )
    )
  assert.equal(receipt(completed).status, "ok")
  assert.equal(receipt(queued).status, "pending")
  assert.notEqual(queued.ctx.env.PR_RESULT_DIR, completed.ctx.env.PR_RESULT_DIR)
})
