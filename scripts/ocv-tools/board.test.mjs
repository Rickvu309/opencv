import assert from "node:assert/strict"
import test from "node:test"
import { checkState, groupOf, prFor } from "./board.mjs"
import { claimMarker } from "./claim-marker.mjs"
import { runCli } from "./cli.mjs"
import { fakeCtx, issueData, minutesAgo } from "./fake-ctx.mjs"

const claim = (agent, minutes, id = 1) => ({
  databaseId: id,
  author: { login: agent },
  createdAt: minutesAgo(minutes),
  updatedAt: minutesAgo(minutes),
  body: claimMarker({ agent, at: "client", branch: "feat/1-x" }),
})

const approved = {
  databaseId: 9,
  author: { login: "owner" },
  createdAt: "2026-10-29T11:00:00Z",
  updatedAt: "2026-10-29T11:00:00Z",
  body: "/approve",
}

const DETAILS = {
  10: { title: "feat: Needs the owner", risk: "high" },
  11: { title: "feat: Free work", risk: "normal" },
  13: {
    title: "feat: Left idle",
    risk: "low",
    comments: { nodes: [claim("bea", 180)] },
  },
  14: { title: "feat: In review", risk: "normal" },
  15: {
    title: "feat: Held but high",
    risk: "high",
    comments: { nodes: [claim("cy", 5)] },
  },
  16: {
    title: "feat: Approved review",
    risk: "high",
    comments: { nodes: [approved] },
  },
}

function issue(n, over = {}) {
  const spec = { ...DETAILS[n], ...over }
  return issueData({
    number: n,
    title: spec.title ?? `feat: Issue ${n}`,
    labels: { nodes: [{ name: `risk:${spec.risk ?? "normal"}` }] },
    comments: spec.comments ?? { nodes: [] },
    lastEditedAt: spec.lastEditedAt ?? null,
  })
}

function listPage(nodes, hasNextPage, endCursor) {
  return JSON.stringify({
    data: {
      repository: {
        issues: { pageInfo: { hasNextPage, endCursor }, nodes },
      },
    },
  })
}

function graphql(line) {
  if (line.includes("issues(states:OPEN")) {
    const cursor = / -f cursor=(\S+)/.exec(line)?.[1]
    if (!cursor)
      return listPage([{ number: 10 }, { number: 11 }], true, "list2")
    if (cursor === "list2")
      return listPage(
        [12, 13, 14, 15, 16].map((number) => ({ number })),
        false,
        null
      )
    return listPage([{ number: 12 }], true, "list2")
  }
  const n = Number(/ -F n=(\d+)/.exec(line)?.[1])
  const cursor = / -f cursor=(\S+)/.exec(line)?.[1]
  if (n === 12) {
    if (!cursor)
      return issue(12, {
        title: "feat: Held work",
        risk: "normal",
        comments: {
          pageInfo: { hasPreviousPage: true, startCursor: "c1" },
          nodes: [
            {
              databaseId: 2,
              author: { login: "x" },
              createdAt: minutesAgo(1),
              updatedAt: minutesAgo(1),
              body: "later note",
            },
          ],
        },
      })
    return issue(12, {
      title: "feat: Held work",
      risk: "normal",
      comments: {
        pageInfo: { hasPreviousPage: false, startCursor: null },
        nodes: [claim("ada", 10)],
      },
    })
  }
  return issue(n)
}

const PRS = JSON.stringify([
  {
    number: 140,
    state: "OPEN",
    headRefName: "feat/14-work",
    statusCheckRollup: [{ status: "COMPLETED", conclusion: "FAILURE" }],
  },
  {
    number: 160,
    state: "OPEN",
    headRefName: "feat/16-work",
    statusCheckRollup: [{ status: "COMPLETED", conclusion: "SUCCESS" }],
  },
  {
    number: 161,
    state: "MERGED",
    headRefName: "feat/16-old",
    statusCheckRollup: [],
  },
  {
    number: 900,
    state: "OPEN",
    headRefName: "feat/900-other",
    statusCheckRollup: [],
  },
])

function ctxOf(graph = graphql) {
  return fakeCtx([
    ["repo view", '{"owner":{"login":"owner"},"name":"opencv"}'],
    ["api graphql", (line) => ({ ok: true, out: graph(line), err: "" })],
    ["pr list", PRS],
  ])
}

function split(text) {
  const at = text.lastIndexOf("\nNext: ")
  assert.ok(at > 0, text)
  return { body: text.slice(0, at), next: text.slice(at + 7) }
}

test("checkState, groupOf and prFor", () => {
  assert.equal(checkState(null), "none")
  assert.equal(checkState([]), "none")
  assert.equal(
    checkState([{ status: "COMPLETED", conclusion: "SUCCESS" }]),
    "passing"
  )
  assert.equal(
    checkState([{ status: "COMPLETED", conclusion: "FAILURE" }]),
    "failing"
  )
  assert.equal(checkState([{ status: "IN_PROGRESS" }]), "pending")
  assert.equal(checkState([{ state: "SUCCESS" }]), "passing")
  assert.equal(
    groupOf({ risk: "high", approved: false, claim: "live", prOpen: true }),
    "waiting"
  )
  assert.equal(
    groupOf({ risk: "high", approved: true, claim: "none", prOpen: true }),
    "inReview"
  )
  assert.equal(
    groupOf({ risk: "normal", approved: true, claim: "live", prOpen: false }),
    "taken"
  )
  assert.equal(
    groupOf({ risk: "normal", approved: true, claim: "idle", prOpen: false }),
    "idle"
  )
  assert.equal(
    groupOf({
      risk: "low",
      approved: false,
      claim: "released",
      prOpen: false,
    }),
    "free"
  )
  assert.equal(
    prFor([{ number: 1, state: "OPEN", headRefName: "feat/900-x" }], 90),
    null
  )
  assert.equal(
    prFor([{ number: 2, state: "OPEN", headRefName: "feat/90-x" }], 90).number,
    2
  )
})

test("board groups open issues and reads a claim past the first comment page", () => {
  const ctx = ctxOf()
  const { code, text } = runCli(["board"], ctx)
  assert.equal(code, 0, text)
  const { body, next } = split(text)
  assert.match(body, /Waiting for approval \(2\)/)
  assert.match(body, /Open and free \(1\)/)
  assert.match(body, /Taken \(1\)/)
  assert.match(body, /Idle \(past 180 min\) \(1\)/)
  assert.match(body, /In review \(2\)/)
  const waiting = body.split("Open and free")[0]
  assert.match(waiting, /\b10\b/)
  assert.match(waiting, /\b15\b/)
  assert.match(waiting, /\bcy\b/)
  assert.doesNotMatch(waiting, /\b16\b/)
  assert.match(body, /\bada\b/)
  assert.match(body, /\b180\b/)
  assert.match(body, /#140 open\s+failing/)
  assert.match(body, /#160 open\s+passing/)
  assert.doesNotMatch(body, /#900/)
  assert.match(next, /ocv-tools\.mjs take 11/)
  const issue12 = ctx.calls.filter((c) => c.includes("-F n=12"))
  assert.ok(issue12.length >= 2, issue12.join("\n"))
  const lists = ctx.calls.filter((c) => c.includes("issues(states:OPEN"))
  assert.equal(lists.length, 2)
  assert.match(lists[1], /cursor=list2/)
  assert.ok(!ctx.calls.some((c) => /issue comment|release |git /.test(c)))
})

test("board --json prints the same groups", () => {
  const { code, text } = runCli(["board", "--json"], ctxOf())
  assert.equal(code, 0, text)
  const { body, next } = split(text)
  const groups = JSON.parse(body)
  assert.deepEqual(
    groups.waiting.map((row) => row.number),
    [10, 15]
  )
  assert.equal(groups.waiting.find((row) => row.number === 15).claim, "live")
  assert.equal(groups.free[0].number, 11)
  assert.equal(groups.free[0].claim, "none")
  assert.equal(groups.taken[0].holder, "ada")
  assert.equal(groups.taken[0].idleMinutes, 10)
  assert.equal(groups.idle[0].holder, "bea")
  assert.equal(groups.idle[0].idleMinutes, 180)
  assert.equal(
    groups.inReview.find((row) => row.number === 14).checks,
    "failing"
  )
  assert.equal(groups.inReview.find((row) => row.number === 16).pr.number, 160)
  assert.match(next, /take 11/)
})

test("board refuses a stuck issue page, an unknown flag and an extra argument", () => {
  const stuck = ctxOf((line) => {
    if (line.includes("issues(states:OPEN"))
      return listPage([{ number: 10 }], true, "stuck")
    return issue(10)
  })
  const refused = runCli(["board"], stuck)
  assert.equal(refused.code, 2, refused.text)
  assert.match(refused.text, /REFUSED UNKNOWN/)
  assert.match(refused.text, /\nFix: /)
  assert.match(runCli(["board", "--publish"], fakeCtx([])).text, /UNKNOWN_FLAG/)
  assert.equal(runCli(["board", "10"], fakeCtx([])).code, 1)
})

test("an empty board still ends with Next", () => {
  const ctx = ctxOf((line) => {
    if (line.includes("issues(states:OPEN")) return listPage([], false, null)
    return issue(1)
  })
  const { code, text } = runCli(["board"], ctx)
  assert.equal(code, 0, text)
  assert.match(text, /Waiting for approval \(0\)\nNone\./)
  assert.match(text, /\nNext: scripts\/ocv-tools\.mjs help/)
})

test("help lists board", () => {
  const { text } = runCli(["help"], fakeCtx([]))
  assert.match(text, /board \[--json\]/)
  assert.match(text, /waiting for approval/)
})
