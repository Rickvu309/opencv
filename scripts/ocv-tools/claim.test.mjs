import assert from "node:assert/strict"
import test from "node:test"
import { runCli } from "./cli.mjs"
import { heartbeat } from "./claim.mjs"
import {
  claimMarker,
  holderLine,
  holderOf,
  parseMarker,
  releaseMarker,
} from "./claim-marker.mjs"
import { readServerNow } from "./clock.mjs"
import { ghAdapter } from "./ports/gh.mjs"
import { NOW, ctxFor, fakePorts, issue, minutesAgo } from "./ports/fake.mjs"

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

test("markers round trip and the newest marker decides the holder", () => {
  assert.deepEqual(parseMarker(claim("a1", 5).body).agent, "a1")
  assert.equal(parseMarker("plain comment"), null)
  const rel = releaseMarker({
    agent: "a1",
    at: minutesAgo(1),
    reason: "a --> b\nc",
  })
  assert.equal(parseMarker(rel).reason, "a -- b c")
  assert.equal(holderOf([]).state, "none")
  assert.equal(
    holderOf([claim("a1", 179)], Date.parse(minutesAgo(0))).state,
    "live"
  )
  assert.equal(
    holderOf([claim("a1", 180)], Date.parse(minutesAgo(0))).state,
    "idle"
  )
  assert.equal(holderOf([claim("a1", 5), { body: rel }]).state, "released")
  const taken = holderOf(
    [claim("a1", 300), claim("a2", 10, 2)],
    Date.parse(minutesAgo(0))
  )
  assert.equal(taken.agent, "a2")
  assert.match(holderLine(taken), /held by a2, last saved 10 min ago/)
  assert.match(holderLine({ state: "none" }), /none/)
})

test("take refuses a pull request number, a closed issue and a live claim by another agent", () => {
  const notIssue = run({ issues: [] })
  assert.match(
    runCli(["take", "91"], notIssue.ctx).text,
    /REFUSED NOT_AN_ISSUE/
  )
  const closed = run({ issues: [issue(90, { state: "CLOSED" })] })
  assert.match(runCli(["take", "90"], closed.ctx).text, /REFUSED CLOSED/)
  const held = run({
    issues: [issue(90, { comments: [claim("a1", 30)] })],
  })
  const r = runCli(["take", "90"], held.ctx)
  assert.equal(r.code, 2)
  assert.match(r.text, /REFUSED HELD.*a1.*30 min/)
  assert.match(r.text, /\nFix: /)
  assert.equal(held.ports.counts.issue, 1)
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

test("take: risk:high needs an /approve after the last edit", () => {
  const { ctx } = run({
    issues: [
      issue(90, {
        labels: ["risk:high"],
        lastEditedAt: "2026-10-10T00:00:00Z",
        comments: [
          {
            author: { login: "owner" },
            body: "/approve",
            createdAt: "2026-10-05T00:00:00Z",
          },
        ],
      }),
    ],
  })
  const result = runCli(["take", "90"], ctx)
  assert.match(result.text, /REFUSED NEEDS_APPROVAL/)
  assert.match(
    result.text,
    /Fix: Post a fresh \/approve comment as a project admin\./
  )
  const edited = run({
    issues: [
      issue(90, {
        labels: ["risk:high"],
        lastEditedAt: "2026-10-10T00:00:00Z",
        comments: [
          {
            databaseId: 71,
            author: { login: "owner" },
            body: "/approve",
            createdAt: "2026-10-11T00:00:00Z",
          },
        ],
      }),
    ],
  })
  edited.ports.gh.editComment(71, "/approve")
  const editedResult = runCli(["take", "90"], edited.ctx)
  assert.match(editedResult.text, /REFUSED NEEDS_APPROVAL/)
  assert.match(editedResult.text, /Post a fresh \/approve comment/)
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

test("release posts a release marker for the holder and refuses anyone else", () => {
  const mine = run({
    env: { OCV_TOOLS_AGENT: "me" },
    issues: [issue(90, { comments: [claim("me", 10)] })],
  })
  const r = runCli(["release", "--reason", "blocked on a decision"], mine.ctx)
  assert.equal(r.code, 0, r.text)
  const posted = mine.ports.effects.find((e) => e.op === "comment")
  assert.match(posted.body, /ocv-tools release agent=me/)
  assert.match(posted.body, /reason=blocked on a decision/)
  const other = run({
    env: { OCV_TOOLS_AGENT: "me" },
    issues: [issue(90, { comments: [claim("a1", 10)] })],
  })
  const no = runCli(["release", "--reason", "x"], other.ctx)
  assert.equal(no.code, 2)
  assert.match(no.text, /REFUSED NOT_OWNER.*a1 does/)
  assert.equal(runCli(["release"], mine.ctx).code, 1)
})

test("a client clock does not decide the lease", () => {
  const day = 24 * 60 * 60 * 1000
  const live = issue(90, {
    comments: [
      {
        databaseId: 1,
        createdAt: minutesAgo(1),
        updatedAt: minutesAgo(1),
        body: claimMarker({
          agent: "a1",
          at: new Date(NOW + day).toISOString(),
          branch: "feat/90-x",
        }),
      },
    ],
  })
  const skew = (clientNow) => {
    const { ports, ctx } = run({
      issues: [live],
      worktrees: [
        { path: "/wt/90-keep-my-search", branch: "feat/90-keep-my-search" },
      ],
    })
    ports.state.now = () => clientNow
    return runCli(["take", "90"], ctx)
  }
  for (const clientNow of [NOW + day, NOW - day]) {
    const r = skew(clientNow)
    assert.match(r.text, /REFUSED HELD/)
    assert.doesNotMatch(r.text, /WORKTREE_EXISTS/)
  }
})

test("a comment timestamp ahead of the server is not a live claim", () => {
  const future = new Date(NOW + 24 * 60 * 60 * 1000).toISOString()
  const h = holderOf(
    [
      {
        databaseId: 1,
        createdAt: future,
        updatedAt: future,
        body: claimMarker({ agent: "a1", at: future, branch: "feat/90-x" }),
      },
    ],
    NOW
  )
  assert.equal(h.state, "idle")
  assert.equal(h.idleMinutes, Infinity)
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

test("heartbeat lease is the PATCH updatedAt, not the client clock", () => {
  const calls = []
  const run = (cmd, args) => {
    calls.push(`${cmd} ${args.join(" ")}`)
    return {
      ok: true,
      out: 'Date: Thu, 29 Oct 2026 12:00:05 GMT\r\n\r\n{"updated_at":"2026-10-29T12:00:05Z"}',
      err: "",
    }
  }
  const stamp = heartbeat(
    {
      now: () => NOW + 24 * 60 * 60 * 1000,
      ports: { gh: ghAdapter(run) },
    },
    90,
    { id: 7, branch: "feat/90-x", updatedAt: minutesAgo(10) },
    "me"
  )
  assert.equal(stamp, "2026-10-29T12:00:05.000Z")
  const body = calls.find((c) => c.includes("PATCH"))
  assert.ok(!body.includes("2026-10-30"))
  const h = holderOf(
    [
      {
        databaseId: 7,
        updatedAt: stamp,
        createdAt: minutesAgo(10),
        body: claimMarker({
          agent: "me",
          at: "2026-10-30T12:00:00.000Z",
          branch: "feat/90-x",
        }),
      },
    ],
    NOW
  )
  assert.equal(h.state, "live")
  assert.equal(h.idleMinutes, 0)
})

test("a cut-off claim history is refused instead of looking unclaimed", () => {
  for (const [history, pattern] of [
    ["cap", /incomplete/],
    ["stuck", /cursor/],
  ]) {
    const { ctx } = run({ history })
    const r = runCli(["status", "90"], ctx)
    assert.equal(r.code, 2, r.text)
    assert.match(r.text, /REFUSED UNKNOWN/)
    assert.match(r.text, pattern)
    assert.match(r.text, /\nFix: /)
    assert.doesNotMatch(r.text, /Claim: none/)
  }
})

test("status shows the claim holder and its idle minutes", () => {
  const { ports, ctx } = run({
    issues: [issue(90, { comments: [claim("a1", 42)] })],
  })
  assert.match(
    runCli(["status", "90"], ctx).text,
    /Claim: held by a1, last saved 42 min ago/
  )
  assert.equal(ports.counts.issue, 1)
})
