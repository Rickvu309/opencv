import assert from "node:assert/strict"
import test from "node:test"
import { checkState, groupOf, prFor } from "./board.mjs"
import { claimMarker } from "./claim-marker.mjs"
import { runCli } from "./cli.mjs"
import { ghAdapter } from "./ports/gh.mjs"
import { ctxFor, fakePorts, minutesAgo } from "./ports/fake.mjs"

function scriptedCtx(rules) {
  const calls = []
  const run = (cmd, args) => {
    const line = `${cmd} ${args.join(" ")}`
    calls.push(line)
    if (line.includes("api --include /rate_limit"))
      return {
        ok: true,
        out: "Date: Thu, 29 Oct 2026 12:00:00 GMT\r\n\r\n{}",
        err: "",
      }
    if (line.includes("collaborators?permission=admin"))
      return { ok: true, out: "owner\n", err: "" }
    for (const [match, result] of rules)
      if (line.includes(match))
        return typeof result === "function"
          ? result(line)
          : { ok: true, out: result, err: "" }
    return { ok: false, out: "", err: `unmocked: ${line}` }
  }
  const ports = fakePorts({ issues: [] })
  ports.gh = ghAdapter(run)
  const ctx = ctxFor(ports)
  ctx.calls = calls
  return ctx
}

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

function comments(nodes, hasNextPage = false, endCursor = null) {
  return { pageInfo: { hasNextPage, endCursor }, nodes }
}

function issueNode(n, over = {}) {
  const spec = { ...DETAILS[n], ...over }
  const given = spec.comments
  return {
    number: n,
    title: spec.title ?? `feat: Issue ${n}`,
    state: spec.state ?? "OPEN",
    body: spec.body ?? "### Risk\n\nnormal\n",
    createdAt: "2026-10-01T00:00:00Z",
    lastEditedAt: spec.lastEditedAt ?? null,
    labels: { nodes: [{ name: `risk:${spec.risk ?? "normal"}` }] },
    comments: given?.pageInfo ? given : comments(given?.nodes ?? []),
  }
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

function prPage(nodes, hasNextPage, endCursor) {
  return JSON.stringify({
    data: {
      repository: {
        pullRequests: { pageInfo: { hasNextPage, endCursor }, nodes },
      },
    },
  })
}

function commentPage(nodes, hasNextPage = false, endCursor = null) {
  return JSON.stringify({
    data: {
      repository: {
        issue: { comments: comments(nodes, hasNextPage, endCursor) },
      },
    },
  })
}

const OPEN_PRS = [
  {
    number: 140,
    state: "OPEN",
    headRefName: "feat/14-work",
    headRefOid: "sha140",
  },
  {
    number: 160,
    state: "OPEN",
    headRefName: "feat/16-work",
    headRefOid: "sha160",
  },
  {
    number: 900,
    state: "OPEN",
    headRefName: "feat/900-other",
    headRefOid: "sha900",
  },
]

function checkRuns(line) {
  const run = (conclusion) => [
    {
      name: "ci",
      status: "completed",
      conclusion,
      started_at: "2026-10-29T11:00:00Z",
    },
  ]
  const check_runs = line.includes("sha140")
    ? run("failure")
    : line.includes("sha160")
      ? run("success")
      : []
  return { ok: true, out: JSON.stringify({ check_runs }), err: "" }
}

function graphql(line) {
  if (line.includes("pullRequests(states:OPEN"))
    return prPage(OPEN_PRS, false, null)
  if (line.includes("comments(first:100,after:")) {
    const n = Number(/ -F n=(\d+)/.exec(line)?.[1])
    if (n === 12) return commentPage([claim("ada", 10)])
    return commentPage([])
  }
  if (line.includes("issues(states:OPEN")) {
    const cursor = / -f cursor=(\S+)/.exec(line)?.[1]
    if (!cursor) return listPage([issueNode(10), issueNode(11)], true, "list2")
    if (cursor === "list2")
      return listPage(
        [
          issueNode(12, {
            title: "feat: Held work",
            risk: "normal",
            comments: comments(
              [
                {
                  databaseId: 2,
                  author: { login: "x" },
                  createdAt: minutesAgo(1),
                  updatedAt: minutesAgo(1),
                  body: "later note",
                },
              ],
              true,
              "c1"
            ),
          }),
          issueNode(13),
          issueNode(14),
          issueNode(15),
          issueNode(16),
        ],
        false,
        null
      )
    return listPage([issueNode(12)], true, "list2")
  }
  throw new Error(`unexpected graphql ${line.slice(0, 160)}`)
}

function ctxOf(graph = graphql) {
  return scriptedCtx([
    ["repo view", '{"owner":{"login":"owner","type":"User"},"name":"opencv"}'],
    ["api graphql", (line) => ({ ok: true, out: graph(line), err: "" })],
    ["check-runs", checkRuns],
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
    groupOf({ risk: "low", approved: false, claim: "released", prOpen: false }),
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
  assert.equal(issue12.length, 1, issue12.join("\n"))
  assert.match(issue12[0], /cursor=c1/)
  const lists = ctx.calls.filter((c) => c.includes("issues(states:OPEN"))
  assert.equal(lists.length, 2)
  assert.match(lists[1], /cursor=list2/)
  assert.equal(ctx.calls.filter((c) => c.includes("repo view")).length, 1)
  assert.equal(ctx.calls.filter((c) => c.includes("/rate_limit")).length, 1)
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

test("board reads 50 issues with a constant handful of gh calls", () => {
  const once = (count) => {
    const ctx = scriptedCtx([
      [
        "repo view",
        '{"owner":{"login":"owner","type":"User"},"name":"opencv"}',
      ],
      [
        "api graphql",
        (line) => {
          if (line.includes("pullRequests(states:OPEN"))
            return { ok: true, out: prPage([], false, null), err: "" }
          if (line.includes("issues(states:OPEN")) {
            const nodes = Array.from({ length: count }, (_, i) =>
              issueNode(i + 1, {
                title: `feat: Issue ${i + 1}`,
                risk: "normal",
                comments: comments([
                  {
                    databaseId: i + 1,
                    author: { login: "owner" },
                    createdAt: minutesAgo(1),
                    updatedAt: minutesAgo(1),
                    body: "note",
                  },
                ]),
              })
            )
            return { ok: true, out: listPage(nodes, false, null), err: "" }
          }
          return { ok: false, out: "", err: `unexpected ${line.slice(0, 120)}` }
        },
      ],
    ])
    const { code, text } = runCli(["board", "--json"], ctx)
    assert.equal(code, 0, text)
    const groups = JSON.parse(split(text).body)
    assert.equal(groups.free.length, count)
    return ctx.calls
  }
  const small = once(1)
  const many = once(50)
  assert.equal(small.length, many.length)
  assert.ok(many.length <= 6, `${many.length}\n${many.join("\n")}`)
  assert.equal(many.filter((c) => c.includes("repo view")).length, 1)
  assert.equal(many.filter((c) => c.includes("/rate_limit")).length, 1)
  assert.equal(many.filter((c) => c.includes("issues(states:OPEN")).length, 1)
  assert.match(
    many.find((c) => c.includes("issues(states:OPEN")),
    /comments\(first:100\)/
  )
  assert.equal(many.filter((c) => c.includes("-F n=")).length, 0)
  assert.equal(
    many.filter((c) => c.includes("pullRequests(states:OPEN")).length,
    1
  )
})

test("an open pull request behind newer closed ones stays in review", () => {
  const closed = Array.from({ length: 200 }, (_, i) => ({
    number: 1000 + i,
    state: "CLOSED",
    headRefName: `chore/${1000 + i}-done`,
  }))
  const ctx = scriptedCtx([
    ["repo view", '{"owner":{"login":"owner","type":"User"},"name":"opencv"}'],
    [
      "api graphql",
      (line) => {
        if (line.includes("issues(states:OPEN"))
          return {
            ok: true,
            out: listPage(
              [issueNode(14, { title: "feat: Old review", risk: "normal" })],
              false,
              null
            ),
            err: "",
          }
        if (line.includes("pullRequests(states:OPEN")) {
          const cursor = / -f cursor=(\S+)/.exec(line)?.[1]
          if (!cursor)
            return {
              ok: true,
              out: prPage(
                [
                  {
                    number: 8,
                    state: "OPEN",
                    headRefName: "feat/8-other",
                    headRefOid: "sha8",
                  },
                ],
                true,
                "pr2"
              ),
              err: "",
            }
          return {
            ok: true,
            out: prPage(
              [
                {
                  number: 14,
                  state: "OPEN",
                  headRefName: "feat/14-work",
                  headRefOid: "sha14",
                },
              ],
              false,
              null
            ),
            err: "",
          }
        }
        return { ok: false, out: "", err: `unexpected ${line.slice(0, 120)}` }
      },
    ],
    ["pr list", JSON.stringify(closed)],
    [
      "check-runs",
      () => ({
        ok: true,
        out: JSON.stringify({
          check_runs: [
            {
              name: "ci",
              status: "completed",
              conclusion: "failure",
              started_at: "2026-10-29T09:00:00Z",
            },
            {
              name: "ci",
              status: "completed",
              conclusion: "success",
              started_at: "2026-10-29T11:00:00Z",
            },
          ],
        }),
        err: "",
      }),
    ],
  ])
  const { code, text } = runCli(["board", "--json"], ctx)
  assert.equal(code, 0, text)
  const groups = JSON.parse(split(text).body)
  const row = groups.inReview.find((item) => item.number === 14)
  assert.ok(row, text)
  assert.equal(row.pr.number, 14)
  assert.equal(row.pr.state, "open")
  assert.equal(row.checks, "passing")
  assert.ok(!ctx.calls.some((c) => c.includes("pr list")))
  const pages = ctx.calls.filter((c) => c.includes("pullRequests(states:OPEN"))
  assert.equal(pages.length, 2)
  assert.match(pages[1], /cursor=pr2/)
  const checks = ctx.calls.filter((c) => c.includes("check-runs"))
  assert.equal(checks.length, 1)
  assert.match(checks[0], /sha14/)
  assert.match(checks[0], /check_name=ci/)
  assert.match(checks[0], /filter=latest/)
  // gh api switches to POST when -f fields are given, and the check-runs listing is a GET.
  assert.match(checks[0], /--method GET/)
})

test("board refuses a stuck issue page, a stuck comment page, an unknown flag and an extra argument", () => {
  const stuck = ctxOf((line) => {
    if (line.includes("pullRequests(states:OPEN"))
      return prPage([], false, null)
    if (line.includes("issues(states:OPEN"))
      return listPage([issueNode(10)], true, "stuck")
    throw new Error(`unexpected ${line.slice(0, 120)}`)
  })
  const refused = runCli(["board"], stuck)
  assert.equal(refused.code, 2, refused.text)
  assert.match(refused.text, /REFUSED UNKNOWN/)
  assert.match(refused.text, /\nFix: /)
  const cut = ctxOf((line) => {
    if (line.includes("pullRequests(states:OPEN"))
      return prPage([], false, null)
    if (line.includes("comments(first:100,after:"))
      return commentPage([], true, "c1")
    if (line.includes("issues(states:OPEN"))
      return listPage(
        [issueNode(10, { comments: comments([], true, "c1") })],
        false,
        null
      )
    throw new Error(`unexpected ${line.slice(0, 120)}`)
  })
  const partial = runCli(["board"], cut)
  assert.equal(partial.code, 2, partial.text)
  assert.match(partial.text, /REFUSED UNKNOWN/)
  assert.match(
    runCli(["board", "--publish"], scriptedCtx([])).text,
    /UNKNOWN_FLAG/
  )
  assert.equal(runCli(["board", "10"], scriptedCtx([])).code, 1)
})

test("an empty board still ends with Next", () => {
  const ctx = ctxOf((line) => {
    if (line.includes("pullRequests(states:OPEN"))
      return prPage([], false, null)
    if (line.includes("issues(states:OPEN")) return listPage([], false, null)
    throw new Error(`unexpected ${line.slice(0, 120)}`)
  })
  const { code, text } = runCli(["board"], ctx)
  assert.equal(code, 0, text)
  assert.match(text, /Waiting for approval \(0\)\nNone\./)
  assert.match(text, /\nNext: scripts\/ocv-tools\.mjs help/)
})

test("help lists board", () => {
  const { text } = runCli(["help"], scriptedCtx([]))
  assert.match(text, /board \[--json\]/)
  assert.match(text, /waiting for approval/)
})
