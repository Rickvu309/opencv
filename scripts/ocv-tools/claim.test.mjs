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
import { loadIssue } from "./report.mjs"
import { NOW, fakeCtx, issueData, minutesAgo } from "./fake-ctx.mjs"

const claim = (agent, minutes, id = 1) => ({
  databaseId: id,
  createdAt: minutesAgo(minutes),
  updatedAt: minutesAgo(minutes),
  body: claimMarker({ agent, at: minutesAgo(minutes), branch: "feat/90-x" }),
})

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

const takeRules = (data, extra = []) => [
  ["repo view", '{"owner":{"login":"owner"},"name":"opencv"}'],
  ["api graphql", data],
  ["api user", "me"],
  ["rev-parse --show-toplevel", "/repo"],
  ["rev-parse --absolute-git-dir", "/repo/.git/worktrees/90-keep"],
  ...extra,
]
const afterMade = [
  [
    "worktree list",
    "worktree /repo\nbranch refs/heads/main\n\nworktree /wt/90-keep-my-search\nbranch refs/heads/feat/90-keep-my-search\n",
  ],
]

test("take refuses a pull request number, a closed issue and a live claim by another agent", () => {
  const notIssue = fakeCtx([
    ["repo view", '{"owner":{"login":"o"},"name":"r"}'],
    ["api graphql", () => ({ ok: false, out: "", err: "not found" })],
  ])
  assert.match(runCli(["take", "91"], notIssue).text, /REFUSED NOT_AN_ISSUE/)
  const closed = runCli(
    ["take", "90"],
    fakeCtx(takeRules(issueData({ state: "CLOSED" })))
  )
  assert.match(closed.text, /REFUSED CLOSED/)
  const held = runCli(
    ["take", "90"],
    fakeCtx(takeRules(issueData({ comments: { nodes: [claim("a1", 30)] } })))
  )
  assert.equal(held.code, 2)
  assert.match(held.text, /REFUSED HELD.*a1.*30 min/)
  assert.match(held.text, /\nFix: /)
})

test("take refuses a worktree that already exists and creates nothing", () => {
  const ctx = fakeCtx(takeRules(issueData(), afterMade))
  assert.match(runCli(["take", "90"], ctx).text, /REFUSED WORKTREE_EXISTS/)
  assert.ok(!ctx.calls.some((c) => c.includes("worktree add")))
})

test("take: risk:high needs an /approve after the last edit", () => {
  const high = {
    labels: { nodes: [{ name: "risk:high" }] },
    lastEditedAt: "2026-10-10T00:00:00Z",
    comments: {
      nodes: [
        {
          author: { login: "owner" },
          body: "/approve",
          createdAt: "2026-10-05T00:00:00Z",
        },
      ],
    },
  }
  const r = runCli(["take", "90"], fakeCtx(takeRules(issueData(high))))
  assert.match(r.text, /REFUSED NEEDS_APPROVAL/)
})

test("take refuses ready-for-human and an issue assigned to someone else unless --take", () => {
  const human = issueData({ labels: { nodes: [{ name: "ready-for-human" }] } })
  assert.match(
    runCli(["take", "90"], fakeCtx(takeRules(human))).text,
    /REFUSED READY_FOR_HUMAN/
  )
  const other = issueData({ assignees: { nodes: [{ login: "someone" }] } })
  const r = runCli(["take", "90"], fakeCtx(takeRules(other)))
  assert.match(r.text, /REFUSED ASSIGNED.*someone/)
})

const releaseRules = (comments) => [
  ["repo view", '{"owner":{"login":"owner"},"name":"opencv"}'],
  ["api graphql", issueData({ comments: { nodes: comments } })],
  ["rev-parse --absolute-git-dir", "/repo/.git/worktrees/90-keep"],
  ["rev-parse --path-format=absolute --git-common-dir", "/repo/.git"],
  ["rev-parse --abbrev-ref", "feat/90-keep-my-search"],
  ["rev-parse --show-toplevel", "/repo.worktrees/90-keep"],
  ["issue comment", ""],
]

test("release posts a release marker for the holder and refuses anyone else", () => {
  const mine = fakeCtx(releaseRules([claim("me", 10)]), {
    env: { OCV_TOOLS_AGENT: "me" },
  })
  const r = runCli(["release", "--reason", "blocked on a decision"], mine)
  assert.equal(r.code, 0, r.text)
  assert.ok(
    mine.calls.some(
      (c) =>
        c.includes("ocv-tools release agent=me") &&
        c.includes("reason=blocked on a decision")
    )
  )
  const other = fakeCtx(releaseRules([claim("a1", 10)]), {
    env: { OCV_TOOLS_AGENT: "me" },
  })
  const no = runCli(["release", "--reason", "x"], other)
  assert.equal(no.code, 2)
  assert.match(no.text, /REFUSED NOT_OWNER.*a1 does/)
  assert.equal(runCli(["release"], mine).code, 1)
})

test("a client clock does not decide the lease", () => {
  const behind = fakeCtx(
    takeRules(
      issueData({
        comments: {
          nodes: [
            {
              databaseId: 1,
              createdAt: minutesAgo(1),
              updatedAt: minutesAgo(1),
              body: claimMarker({
                agent: "a1",
                at: minutesAgo(240),
                branch: "feat/90-x",
              }),
            },
          ],
        },
      })
    )
  )
  behind.now = () => NOW - 4 * 60 * 60 * 1000
  behind.serverNow = () => NOW
  assert.match(runCli(["take", "90"], behind).text, /REFUSED HELD/)

  const ahead = fakeCtx(
    takeRules(
      issueData({
        comments: {
          nodes: [
            {
              databaseId: 1,
              createdAt: minutesAgo(200),
              updatedAt: minutesAgo(200),
              body: claimMarker({
                agent: "a1",
                at: new Date(NOW + 24 * 60 * 60 * 1000).toISOString(),
                branch: "feat/90-x",
              }),
            },
          ],
        },
      }),
      [
        [
          "worktree list",
          "worktree /wt\nbranch refs/heads/feat/90-keep-my-search\n",
        ],
      ]
    )
  )
  ahead.now = () => NOW + 24 * 60 * 60 * 1000
  ahead.serverNow = () => NOW
  assert.match(runCli(["take", "90"], ahead).text, /REFUSED WORKTREE_EXISTS/)
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
  const ctx = fakeCtx([
    [
      "-X PATCH",
      'Date: Thu, 29 Oct 2026 12:00:05 GMT\r\n\r\n{"updated_at":"2026-10-29T12:00:05Z"}',
    ],
  ])
  ctx.now = () => NOW + 24 * 60 * 60 * 1000
  const stamp = heartbeat(
    ctx,
    90,
    { id: 7, branch: "feat/90-x", updatedAt: minutesAgo(10) },
    "me"
  )
  assert.equal(stamp, "2026-10-29T12:00:05.000Z")
  const body = ctx.calls.find((c) => c.includes("PATCH"))
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

test("a live claim older than 100 later comments is still the holder", () => {
  const all = [
    {
      databaseId: 1,
      createdAt: minutesAgo(30),
      updatedAt: minutesAgo(5),
      author: { login: "holder" },
      body: claimMarker({
        agent: "holder",
        at: minutesAgo(400),
        branch: "feat/90-x",
      }),
    },
  ]
  for (let i = 2; i <= 150; i++)
    all.push({
      databaseId: i,
      createdAt: minutesAgo(1),
      updatedAt: minutesAgo(1),
      author: { login: "x" },
      body: `note ${i}`,
    })
  const ctx = fakeCtx([
    ["repo view", '{"owner":{"login":"owner"},"name":"opencv"}'],
    [
      "api graphql",
      (line) => {
        const cursor = /cursor=(\S+)/.exec(line)?.[1]
        const nodes = cursor ? all.slice(0, 50) : all.slice(50)
        return {
          ok: true,
          out: issueData({
            comments: {
              pageInfo: {
                hasPreviousPage: !cursor,
                startCursor: cursor ? null : "p1",
              },
              nodes,
            },
          }),
          err: "",
        }
      },
    ],
  ])
  const { issue, serverNow } = loadIssue(ctx, 90)
  assert.equal(issue.comments.nodes.length, 150)
  const h = holderOf(issue.comments.nodes, serverNow)
  assert.equal(h.agent, "holder")
  assert.equal(h.state, "live")
  assert.ok(ctx.calls.filter((c) => c.includes("api graphql")).length >= 2)
})

test("status shows the claim holder and its idle minutes", () => {
  const ctx = fakeCtx([
    ["repo view", '{"owner":{"login":"owner"},"name":"opencv"}'],
    ["api graphql", issueData({ comments: { nodes: [claim("a1", 42)] } })],
    ["pr list", "[]"],
    ["worktree list", ""],
    ["ls-remote", ""],
  ])
  assert.match(
    runCli(["status", "90"], ctx).text,
    /Claim: held by a1, last saved 42 min ago/
  )
})
