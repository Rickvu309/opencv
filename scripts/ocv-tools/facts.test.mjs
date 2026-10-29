import assert from "node:assert/strict"
import test from "node:test"
import { createFacts } from "./facts.mjs"
import { fakePorts } from "./ports/fake.mjs"

test("each fact kind is read once until a race check asks for a fresh copy", () => {
  const ports = fakePorts()
  const facts = createFacts(ports)
  const first = facts.load(90, ["issue", "claim", "local", "pr"])
  const second = facts.load(90, ["issue", "claim", "local", "pr"])
  assert.equal(second.issue, first.issue)
  assert.equal(second.claim, first.claim)
  assert.equal(second.local, first.local)
  assert.equal(ports.counts.issue, 1)
  assert.equal(ports.counts.worktrees, 1)
  assert.equal(ports.counts.prs, 1)
  assert.equal(Object.isFrozen(first.issue), true)
  assert.equal(Object.isFrozen(first.issue.comments), true)
  assert.equal(Object.isFrozen(first.claim), true)
  assert.equal(Object.isFrozen(first.local), true)

  const fresh = facts.load(90, ["issue", "claim"], { fresh: true })
  assert.notEqual(fresh.issue, first.issue)
  assert.equal(ports.counts.issue, 2)
  assert.equal(ports.counts.worktrees, 1)
  facts.load(90, ["local"])
  assert.equal(ports.counts.worktrees, 1)
})
