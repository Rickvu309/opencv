import assert from "node:assert/strict"
import test from "node:test"
import { claimMarker, releaseMarker } from "./claim-marker.mjs"
import { runCli } from "./cli.mjs"
import { blockerMarker, blockerOf } from "./done.mjs"
import { ctxFor, fakePorts, issue, minutesAgo, pr } from "./ports/fake.mjs"

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

test("done exits 0 once a blocker is recorded", () => {
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
  assert.equal(after.code, 0)
  assert.match(after.text, /blocked, #90/)
  assert.match(after.text, /waiting for the owner to pick a pricing/)
  assert.match(after.text, /Nothing is open without a recorded blocker/)
})

test("a new claim on the issue clears an older blocker", () => {
  const comments = [
    claimBy("agent-a", 1),
    comment(
      2,
      blockerMarker({ agent: "agent-a", at: "x", reason: "stuck here" })
    ),
  ]
  assert.equal(blockerOf(comments).reason, "stuck here")
  assert.equal(blockerOf([...comments, claimBy("agent-a", 3)]), null)
  assert.equal(blockerOf([claimBy("agent-a", 1)]), null)
})

test("done exits 0 when this agent holds nothing", () => {
  const { code, text } = runner({
    issues: [],
    prs: [],
    worktrees: [],
  }).call("done")
  assert.equal(code, 0)
  assert.match(text, /none/)
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

test("without an agent id, done counts what is assigned to the account", () => {
  const { code, text } = runner({ env: {} }).call("done")
  assert.equal(code, 1)
  assert.match(text, /no agent id here/)
})

test("with an agent id, an assigned issue nobody claimed is not this agent's", () => {
  const { code } = runner({
    issues: [issue(90, { assignees: ["me"], comments: [] })],
    prs: [],
    worktrees: [],
  }).call("done")
  assert.equal(code, 0)
})

test("an issue assigned to someone else is not this agent's", () => {
  const { code } = runner({
    env: {},
    issues: [
      issue(90, { assignees: ["someone"], comments: [claimBy("agent-b")] }),
    ],
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

test("block needs a real reason and a real issue", () => {
  const { call, ports } = runner()
  assert.equal(call("block", "90", "stuck").code, 1)
  assert.equal(call("block", "90").code, 1)
  assert.equal(call("block", "555", "waiting on the owner here").code, 1)
  assert.equal(ports.effects.filter((e) => e.op === "comment").length, 0)
})
