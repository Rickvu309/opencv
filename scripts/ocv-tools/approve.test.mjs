import assert from "node:assert/strict"
import { join } from "node:path"
import test from "node:test"
import { approveComment } from "./approve.mjs"
import { runCli } from "./cli.mjs"
import { fakeCtx, issueData } from "./fake-ctx.mjs"
import { approvalValid } from "./report.mjs"

const repo = ["repo view", '{"owner":{"login":"owner"},"name":"opencv"}']

function high(over = {}) {
  return issueData({
    state: "OPEN",
    labels: { nodes: [{ name: "risk:high" }] },
    comments: { nodes: [] },
    ...over,
  })
}

function ctxFor(issue, extra = {}) {
  return fakeCtx(
    [
      repo,
      ["api graphql", issue],
      ["issue comment", ""],
      ...(extra.rules ?? []),
    ],
    extra
  )
}

const posted = (ctx) => ctx.calls.find((c) => c.includes("issue comment"))

test("approve posts /approve and names the agent that relayed it", () => {
  const ctx = ctxFor(high(), { env: { OCV_TOOLS_AGENT: "agent-7" } })
  const { code, text } = runCli(["approve", "#90"], ctx)
  assert.equal(code, 0, text)
  assert.match(text, /Posted \/approve on #90/)
  assert.match(
    text,
    /The agent must only run this after the owner said "approved" in this chat\./
  )
  assert.match(text, /\nNext: scripts\/ocv-tools\.mjs take 90/)
  assert.match(
    posted(ctx),
    /--body \/approve\nRelayed by agent agent-7 from the owner in chat\./
  )
  assert.equal(
    approvalValid({
      owner: "owner",
      createdAt: "2026-10-01T00:00:00Z",
      lastEditedAt: "2026-10-29T11:00:00Z",
      comments: [
        {
          author: { login: "owner" },
          body: approveComment("agent-7"),
          createdAt: "2026-10-29T12:00:00Z",
        },
      ],
    }),
    true
  )
})

test("approve reads the agent id from the worktree when the env is unset", () => {
  const gitDir = "/repo/.git/worktrees/90"
  const ctx = ctxFor(high(), {
    files: { [join(gitDir, "ocv-tools-agent")]: "agent-file\n" },
    rules: [
      [
        "rev-parse",
        (line) =>
          line.includes("--absolute-git-dir")
            ? { ok: true, out: gitDir, err: "" }
            : { ok: false, out: "", err: "unmocked" },
      ],
    ],
  })
  const { code, text } = runCli(["approve", "90"], ctx)
  assert.equal(code, 0, text)
  assert.match(
    posted(ctx),
    /Relayed by agent agent-file from the owner in chat\./
  )
})

test("approve refuses anything that is not an open risk:high issue", () => {
  const normal = runCli(
    ["approve", "90"],
    ctxFor(issueData({ labels: { nodes: [{ name: "risk:normal" }] } }))
  )
  assert.equal(normal.code, 2)
  assert.match(normal.text, /REFUSED NOT_HIGH_RISK/)
  assert.match(normal.text, /No approval is needed/)
  assert.match(normal.text, /\nFix: /)
  const low = runCli(
    ["approve", "90"],
    ctxFor(issueData({ labels: { nodes: [{ name: "risk:low" }] } }))
  )
  assert.match(low.text, /NOT_HIGH_RISK/)
  assert.match(low.text, /no approval is needed/)
  const unset = runCli(
    ["approve", "90"],
    ctxFor(issueData({ labels: { nodes: [] }, body: "no risk section" }))
  )
  assert.match(unset.text, /NOT_HIGH_RISK/)
  const closed = runCli(["approve", "90"], ctxFor(high({ state: "CLOSED" })))
  assert.equal(closed.code, 2)
  assert.match(closed.text, /REFUSED CLOSED/)
  const closedLow = runCli(
    ["approve", "90"],
    ctxFor(
      issueData({
        state: "CLOSED",
        labels: { nodes: [{ name: "risk:low" }] },
      })
    )
  )
  assert.match(closedLow.text, /REFUSED CLOSED/)
  const missing = runCli(
    ["approve", "91"],
    ctxFor(
      JSON.stringify({
        data: { repository: { owner: { login: "owner" }, issue: null } },
      })
    )
  )
  assert.equal(missing.code, 2)
  assert.match(missing.text, /REFUSED NOT_AN_ISSUE/)
  for (const result of [normal, low, closed, missing])
    assert.ok(!result.text.includes("issue comment"))
})

test("a valid /approve after the last edit is left as it is", () => {
  const ctx = ctxFor(
    high({
      comments: {
        nodes: [
          {
            author: { login: "owner" },
            body: "/approve\nRelayed by agent old from the owner in chat.",
            createdAt: "2026-10-29T11:00:00Z",
          },
        ],
      },
    }),
    { env: { OCV_TOOLS_AGENT: "agent-7" } }
  )
  const { code, text } = runCli(["approve", "90"], ctx)
  assert.equal(code, 0, text)
  assert.match(text, /already has a valid \/approve/)
  assert.match(text, /Nothing posted/)
  assert.match(text, /owner said "approved"/)
  assert.equal(posted(ctx), undefined)
})

test("an older or foreign /approve does not count, so a new one is posted", () => {
  const stale = ctxFor(
    high({
      lastEditedAt: "2026-10-29T12:00:00Z",
      comments: {
        nodes: [
          {
            author: { login: "owner" },
            body: "/approve",
            createdAt: "2026-10-29T11:00:00Z",
          },
        ],
      },
    }),
    { env: { OCV_TOOLS_AGENT: "agent-7" } }
  )
  assert.equal(runCli(["approve", "90"], stale).code, 0)
  assert.match(posted(stale), /Relayed by agent agent-7/)
  const foreign = ctxFor(
    high({
      comments: {
        nodes: [
          {
            author: { login: "someone" },
            body: "/approve",
            createdAt: "2026-10-29T11:00:00Z",
          },
        ],
      },
    }),
    { env: { OCV_TOOLS_AGENT: "agent-7" } }
  )
  assert.equal(runCli(["approve", "90"], foreign).code, 0)
  assert.match(posted(foreign), /--body \/approve\n/)
})

test("approve usage", () => {
  assert.equal(runCli(["approve"], fakeCtx([])).code, 1)
  assert.equal(runCli(["approve", "0"], fakeCtx([])).code, 1)
  assert.match(
    runCli(["approve", "90", "--yes"], fakeCtx([])).text,
    /UNKNOWN_FLAG/
  )
  const { text } = runCli(["help"], fakeCtx([]))
  assert.match(text, /approve <n>/)
  assert.match(text, /NOT_HIGH_RISK/)
})
