import assert from "node:assert/strict"
import test from "node:test"
import { fixture } from "./fixture.mjs"

const added = (at) => ({ kind: "added", at })
const removed = (reason, at) => ({ kind: "removed", reason, at })
const timeline = [
  added("2026-11-03T12:24:34Z"),
  removed("failed_checks", "2026-11-03T12:31:24Z"),
  added("2026-11-03T12:32:14Z"),
  removed("merged", "2026-11-03T12:38:27Z"),
]

function mergeOnSecondDrop(s) {
  let step = 0
  s.onPause = (_total, state) => {
    step += 1
    if (step === 1) {
      state.inQueue = false
      return
    }
    state.pull.state = "MERGED"
    state.pull.mergeCommit = { oid: "done" }
    state.queueEvents = timeline
  }
}

test("merge --wait follows the latest queue entry, not an older removal", () => {
  const f = fixture({ queue: true })
  assert.match(f.call("merge", "91").text, /Queued/)
  f.s.queueEvents = timeline.slice(0, 3)
  mergeOnSecondDrop(f.s)
  const r = f.call("merge", "91", "--wait")
  assert.equal(r.code, 0, r.text)
  assert.match(r.text, /Merged PR #91/)
  assert.doesNotMatch(r.text, /failed_checks/)
  assert.doesNotMatch(r.text, /2026-11-03T12:31:24Z/)
  assert.equal(f.s.issueState, "CLOSED")
})

test("merge --wait still reports a removal that follows the latest add", () => {
  const f = fixture({ queue: true })
  assert.match(f.call("merge", "91").text, /Queued/)
  f.s.queueEvents = [
    added("2026-11-03T12:32:14Z"),
    removed("failed_checks", "2026-11-03T12:40:00Z"),
  ]
  f.s.onPause = (_total, s) => {
    s.inQueue = false
  }
  const r = f.call("merge", "91", "--wait")
  assert.equal(r.code, 2, r.text)
  assert.match(r.text, /LEFT_QUEUE/)
  assert.match(r.text, /failed_checks/)
  assert.match(r.text, /2026-11-03T12:40:00Z/)
  assert.equal(f.s.issueState, "OPEN")
})

test("merge --wait ignores a removal from before the time this run queued it", () => {
  const f = fixture({
    queue: true,
    now: Date.parse("2026-11-03T12:32:18Z"),
  })
  assert.match(f.call("merge", "91").text, /Queued/)
  f.s.removedEvents = [{ reason: "failed_checks", at: "2026-11-03T12:31:24Z" }]
  mergeOnSecondDrop(f.s)
  const r = f.call("merge", "91", "--wait")
  assert.equal(r.code, 0, r.text)
  assert.match(r.text, /Merged PR #91/)
  assert.doesNotMatch(r.text, /failed_checks/)
  assert.doesNotMatch(r.text, /2026-11-03T12:31:24Z/)
})
