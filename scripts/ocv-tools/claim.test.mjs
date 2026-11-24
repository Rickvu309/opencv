import assert from "node:assert/strict"
import test from "node:test"
import { runCli } from "./cli.mjs"
import { claimMarker, holderOf, parseMarker } from "./claim-marker.mjs"
import { readServerNow } from "./clock.mjs"
import { ctxFor, fakePorts, issue, minutesAgo } from "./ports/fake.mjs"

const claim = (agent, minutes, id = 1) => ({
  databaseId: id,
  createdAt: minutesAgo(minutes),
  updatedAt: minutesAgo(minutes),
  body: claimMarker({ agent, at: minutesAgo(minutes), branch: "feat/90-x" }),
})

function run(over = {}) {
  const ports = fakePorts(over)
  return { ports, ctx: ctxFor(ports) }
}

test("markers round trip, the newest marker names the owner, and an owner note never goes idle", () => {
  assert.deepEqual(parseMarker(claim("a1", 5).body).agent, "a1")
  assert.equal(parseMarker("plain comment"), null)
  const rel = `<!-- ocv-tools release agent=a1 at=${minutesAgo(1)} reason=gave it back -->`
  assert.equal(parseMarker(rel).reason, "gave it back")
  assert.equal(holderOf([]).state, "none")
  assert.equal(holderOf([claim("a1", 5)]).state, "live")
  assert.equal(holderOf([claim("a1", 100000)]).state, "live")
  assert.equal(holderOf([claim("a1", 5), { body: rel }]).state, "released")
  assert.equal(holderOf([claim("a1", 300), claim("a2", 10, 2)]).agent, "a2")
})

test("take refuses a pull request number and a closed issue, and an owner note left by another agent with no task folder here does not block it", () => {
  const notIssue = run({ issues: [] })
  assert.match(
    runCli(["take", "91"], notIssue.ctx).text,
    /REFUSED NOT_AN_ISSUE/
  )
  const closed = run({ issues: [issue(90, { state: "CLOSED" })] })
  assert.match(runCli(["take", "90"], closed.ctx).text, /REFUSED CLOSED/)
  const noted = run({
    issues: [issue(90, { comments: [claim("a1", 30)] })],
  })
  const r = runCli(["take", "90"], noted.ctx)
  assert.equal(r.code, 0, r.text)
  assert.equal(
    noted.ports.effects.filter((e) => e.op === "comment").length,
    1,
    r.text
  )
})

test("take refuses a worktree that already exists and creates nothing", () => {
  const { ports, ctx } = run({
    worktrees: [
      { path: "/wt/90-keep-my-search", branch: "feat/90-keep-my-search" },
    ],
  })
  assert.match(runCli(["take", "90"], ctx).text, /REFUSED WORKTREE_EXISTS/)
  assert.ok(!ports.effects.some((e) => e.op === "addWorktree"))
  assert.deepEqual(ports.effects, [])
})

test("take accepts a risk:high issue with no approval comment", () => {
  const { ports, ctx } = run({
    issues: [issue(90, { labels: ["risk:high", "feat"] })],
  })
  const result = runCli(["take", "90", "--no-install"], ctx)
  assert.equal(result.code, 0, result.text)
  assert.match(result.text, /Took #90/)
  assert.ok(ports.effects.some((e) => e.op === "addWorktree"))
})

test("take refuses ready-for-human and an issue assigned to someone else unless --take", () => {
  const human = run({
    issues: [issue(90, { labels: ["ready-for-human"] })],
  })
  assert.match(
    runCli(["take", "90"], human.ctx).text,
    /REFUSED READY_FOR_HUMAN/
  )
  const other = run({ issues: [issue(90, { assignees: ["someone"] })] })
  assert.match(
    runCli(["take", "90"], other.ctx).text,
    /REFUSED ASSIGNED.*someone/
  )
})

test("readServerNow rejects a missing Date header", () => {
  assert.throws(
    () =>
      readServerNow({
        run: () => ({ ok: true, out: "HTTP/2 200\r\n\r\n{}", err: "" }),
      }),
    /Date header/
  )
})

test("a cut-off claim history is refused instead of looking unclaimed", () => {
  for (const [history, pattern] of [
    ["cap", /incomplete/],
    ["stuck", /cursor/],
  ]) {
    const { ctx } = run({ history })
    const r = runCli(["take", "90"], ctx)
    assert.equal(r.code, 2, r.text)
    assert.match(r.text, /REFUSED UNKNOWN/)
    assert.match(r.text, pattern)
    assert.match(r.text, /\nFix: /)
  }
})
