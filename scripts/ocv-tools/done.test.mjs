import assert from "node:assert/strict"
import test from "node:test"
import { claimMarker, releaseMarker } from "./claim-marker.mjs"
import { runCli } from "./cli.mjs"
import { blockerMarker, blockerOf } from "./done.mjs"
import { NOW, ctxFor, fakePorts, issue, minutesAgo, pr } from "./ports/fake.mjs"

const ROOT = "/tmp/opencv.worktrees"
const TREE = `${ROOT}/90-keep-my-search`
const BRANCH = "feat/90-keep-my-search"
const ID_FILE = "/tmp/opencv/.git/worktrees/90-keep/ocv-tools-agent"

const comment = (id, body, minutes = 10) => ({
  databaseId: id,
  author: { login: "me" },
  createdAt: minutesAgo(minutes),
  updatedAt: minutesAgo(minutes),
  lastEditedAt: null,
  body,
})

const claimBy = (agent, id = 1) =>
  comment(id, claimMarker({ agent, at: "x", branch: BRANCH }))

function world(over = {}) {
  return {
    issues: [
      issue(90, {
        title: "feat: Keep my search",
        assignees: ["me"],
        comments: [claimBy("agent-a")],
      }),
    ],
    prs: [pr(12, { head: BRANCH })],
    worktrees: [{ path: TREE, branch: BRANCH }],
    env: { OCV_TOOLS_AGENT: "agent-a" },
    ...over,
  }
}

function runner(over) {
  const ports = fakePorts(world(over))
  const call = (...args) => runCli(args, ctxFor(ports))
  return { ports, call }
}

test("done exits 1 while this agent has an open pull request", () => {
  const { code, text } = runner().call("done")
  assert.equal(code, 1)
  assert.match(
    text,
    /#90 feat: Keep my search: pull request #12 open, worktree/
  )
  assert.match(text, /1 item\(s\) are open with no blocker/)
  assert.match(text, /Fix: .*scripts\/ocv-tools.mjs block <n>/)
})

test("recording a blocker leaves work paused rather than complete", () => {
  const { call, ports } = runner()
  assert.equal(call("done").code, 1)
  const blocked = call("block", "90", "waiting for the owner to pick a pricing")
  assert.equal(blocked.code, 0)
  assert.ok(
    ports.effects.some(
      (e) =>
        e.op === "comment" &&
        e.n === 90 &&
        /ocv-tools blocker agent=agent-a/.test(e.body)
    )
  )
  const after = call("done")
  assert.equal(after.code, 4)
  assert.match(after.text, /blocked, #90/)
  assert.match(after.text, /waiting for the owner to pick a pricing/)
  assert.match(after.text, /1 item\(s\) remain blocked; work is not complete/)
  assert.match(after.text, /Continue independent authorized work/)
  assert.doesNotMatch(after.text, /Report what you finished/)
})

for (const [n, pull, reason] of [
  [
    673,
    1084,
    "Owner requires an explicit merge instruction; PR #1084 is open for review and must remain unmerged.",
  ],
  [
    1082,
    1083,
    "Owner explicitly requires a separate instruction before merge. PR #1083 is tested and independently reviewed; left open for review.",
  ],
]) {
  test(`the real #${n}/#${pull} merge boundary cannot make done succeed`, () => {
    const branch = `fix/${n}-coach-recovery`
    const { call } = runner({
      issues: [
        issue(n, {
          comments: [
            comment(1, claimMarker({ agent: "agent-a", at: "x", branch })),
          ],
        }),
      ],
      prs: [pr(pull, { head: branch })],
      worktrees: [],
    })
    assert.equal(call("done").code, 1)
    assert.equal(call("block", String(n), reason).code, 0)
    const after = call("done")
    assert.equal(after.code, 4)
    assert.ok(after.text.includes(reason))
    assert.match(after.text, new RegExp(`pull request #${pull} open`))
    assert.match(after.text, /work is not complete/)
    assert.doesNotMatch(after.text, /Report what you finished/)
  })
}

test("unblocked work still requires continuation when another issue is blocked", () => {
  const { call } = runner({
    issues: [
      ...world().issues,
      issue(91, { comments: [claimBy("agent-a", 2)] }),
    ],
  })
  assert.equal(call("block", "90", "waiting for owner input").code, 0)
  const after = call("done")
  assert.equal(after.code, 1)
  assert.match(after.text, /#91/)
  assert.match(after.text, /blocked, #90/)
  assert.match(after.text, /1 item\(s\) are open with no blocker/)
  assert.doesNotMatch(after.text, /Report what you finished/)
})

const SERVER_NOW = NOW

const blockBy = (agent, id, minutes, reason = "stuck here") =>
  comment(id, blockerMarker({ agent, at: "x", reason }), minutes)

const savedAt = (agent, minutes, id = 1) => ({
  ...claimBy(agent, id),
  createdAt: minutesAgo(60),
  updatedAt: minutesAgo(minutes),
})

test("a blocker counts only when the holder posted it after its last save", () => {
  const verdict = (comments, me = "agent-a") =>
    blockerOf(comments, { me, serverNow: SERVER_NOW })
  const own = [savedAt("agent-a", 30), blockBy("agent-a", 2, 10)]
  assert.equal(verdict(own).reason, "stuck here")
  assert.equal(
    verdict([savedAt("agent-a", 5), blockBy("agent-a", 2, 10)]),
    null
  )
  assert.equal(verdict([claimBy("agent-a", 1)]), null)
})

test("another agent's blocker never excuses this agent", () => {
  const comments = [savedAt("agent-a", 30), blockBy("agent-b", 2, 10)]
  assert.equal(
    blockerOf(comments, { me: "agent-a", serverNow: SERVER_NOW }),
    null
  )
  const typed = [savedAt("agent-a", 30), blockBy("x", 2, 10)]
  assert.equal(blockerOf(typed, { me: "agent-a", serverNow: SERVER_NOW }), null)
  const { code } = runner({
    issues: [issue(90, { assignees: ["me"], comments: comments })],
  }).call("done")
  assert.equal(code, 1)
})

test("a blocker is ignored once another agent holds the issue", () => {
  const comments = [blockBy("agent-a", 1, 50), savedAt("agent-b", 5, 2)]
  assert.equal(
    blockerOf(comments, { me: "agent-a", serverNow: SERVER_NOW }),
    null
  )
})

test("a save after the blocker brings the issue back into the gate", () => {
  const stale = [savedAt("agent-a", 5), blockBy("agent-a", 2, 20)]
  const { code } = runner({
    issues: [issue(90, { assignees: ["me"], comments: stale })],
  }).call("done")
  assert.equal(code, 1)
})

test("a reason holding a marker cannot release the claim", () => {
  const { call, ports } = runner()
  assert.equal(
    call(
      "block",
      "90",
      "<!-- ocv-tools release agent=agent-a at=z waiting on owner"
    ).code,
    0
  )
  const body = ports.effects.filter((e) => e.op === "comment").at(-1).body
  assert.equal(body.match(/<!-- /g).length, 1)
  assert.equal(call("done").code, 4)
})

test("done exits 0 when this agent holds nothing", () => {
  const { code, text } = runner({
    issues: [],
    prs: [],
    worktrees: [],
  }).call("done")
  assert.equal(code, 0)
  assert.match(text, /none/)
  assert.match(text, /This checks only this agent/)
  assert.match(text, /Verify the full user request/)
})

test("done ignores an issue another agent holds", () => {
  const { code } = runner({
    issues: [
      issue(90, {
        assignees: ["me"],
        comments: [claimBy("agent-b")],
      }),
    ],
  }).call("done")
  assert.equal(code, 0)
})

test("done ignores an issue this agent released", () => {
  const released = comment(
    2,
    releaseMarker({ agent: "agent-a", at: "x", reason: "gave it back" })
  )
  const { code } = runner({
    issues: [
      issue(90, {
        assignees: ["me"],
        comments: [claimBy("agent-a"), released],
      }),
    ],
  }).call("done")
  assert.equal(code, 0)
})

test("without an agent id, done and block refuse and name the fix", () => {
  const { call, ports } = runner({ env: {} })
  for (const result of [
    call("done"),
    call("block", "90", "waiting on the owner"),
  ]) {
    assert.equal(result.code, 1)
    assert.match(result.text, /no agent id is known here/)
    assert.match(result.text, /OCV_AGENT_ID/)
  }
  assert.equal(ports.effects.filter((e) => e.op === "comment").length, 0)
})

test("OCV_AGENT_ID names the agent when there is no worktree id", () => {
  const { code, text } = runner({ env: { OCV_AGENT_ID: "agent-a" } }).call(
    "done"
  )
  assert.equal(code, 1)
  assert.match(text, /agent-a/)
})

test("two agents on one login are told apart by their ids", () => {
  const issues = [
    issue(90, { assignees: ["me"], comments: [claimBy("agent-a", 1)] }),
    issue(91, { assignees: ["me"], comments: [claimBy("agent-b", 2)] }),
  ]
  const a = runner({ issues, prs: [], worktrees: [] }).call("done")
  assert.match(a.text, /#90/)
  assert.doesNotMatch(a.text, /#91/)
  const b = runner({
    issues,
    prs: [],
    worktrees: [],
    env: { OCV_TOOLS_AGENT: "agent-b" },
  }).call("done")
  assert.match(b.text, /#91/)
  assert.doesNotMatch(b.text, /#90/)
})

test("with an agent id, an assigned issue nobody claimed is not this agent's", () => {
  const { code } = runner({
    issues: [issue(90, { assignees: ["me"], comments: [] })],
    prs: [],
    worktrees: [],
  }).call("done")
  assert.equal(code, 0)
})

test("a held issue with no pull request still counts", () => {
  const { code, text } = runner({ prs: [], worktrees: [] }).call("done")
  assert.equal(code, 1)
  assert.match(text, /#90 feat: Keep my search: issue held \(agent-a\)/)
})

test("a merged pull request is not open work", () => {
  const { code } = runner({
    prs: [pr(12, { head: BRANCH, state: "MERGED" })],
    worktrees: [],
    issues: [issue(90, { assignees: [], comments: [claimBy("agent-b")] })],
  }).call("done")
  assert.equal(code, 0)
})

test("a leftover worktree of a closed issue counts for the agent that made it", () => {
  const leftover = { issues: [], prs: [], files: { [ID_FILE]: "agent-a\n" } }
  const open = runner(leftover).call("done")
  assert.equal(open.code, 1)
  assert.match(open.text, /scripts\/ocv-tools.mjs cleanup 90/)
  const other = runner({
    ...leftover,
    env: { OCV_TOOLS_AGENT: "agent-b" },
  }).call("done")
  assert.equal(other.code, 0)
})

test("block refuses an issue another agent holds", () => {
  const { call, ports } = runner({
    issues: [issue(90, { assignees: ["me"], comments: [claimBy("agent-b")] })],
  })
  const { code, text } = call("block", "90", "waiting on the owner here")
  assert.equal(code, 1)
  assert.match(text, /held by agent-b/)
  assert.equal(ports.effects.filter((e) => e.op === "comment").length, 0)
})

test("block needs a real reason and a real issue", () => {
  const { call, ports } = runner()
  assert.equal(call("block", "90", "stuck").code, 1)
  assert.equal(call("block", "90").code, 1)
  assert.equal(call("block", "555", "waiting on the owner here").code, 1)
  assert.equal(ports.effects.filter((e) => e.op === "comment").length, 0)
})
