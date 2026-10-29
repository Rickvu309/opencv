import assert from "node:assert/strict"
import test from "node:test"
import { runCli } from "./cli.mjs"
import { approvalValid, nextStep } from "./report.mjs"

// A fake gh/git: each rule is [matcher, result]. Unmatched calls fail loudly.
function fakeCtx(rules, files = {}) {
  const calls = []
  const written = {}
  return {
    calls,
    written,
    nodeVersion: "v22.1.0",
    readFile: (path) => files[path],
    writeScratch: (name, text) => {
      written[name] = text
      return `/tmp/${name}`
    },
    run(cmd, args) {
      const line = `${cmd} ${args.join(" ")}`
      calls.push(line)
      for (const [match, result] of rules)
        if (line.includes(match))
          return typeof result === "function"
            ? result(line)
            : { ok: true, out: result, err: "" }
      return { ok: false, out: "", err: `unmocked: ${line}` }
    },
  }
}

const fileArgs = [
  "file",
  "--title",
  "feat: Keep my search",
  "--what",
  "The page forgets your search. This keeps it.",
  "--done",
  "- I come back and the box still has my words.",
  "--risk",
  "low",
]

test("help lists the jobs and ends with Next", () => {
  const { code, text } = runCli(["help"], fakeCtx([]))
  assert.equal(code, 0)
  for (const word of ["file", "status", "doctor", "UNKNOWN_COMMAND", "LOST"])
    assert.ok(text.includes(word), word)
  assert.match(text, /\nNext: /)
})

test("no command shows help; an unknown command exits 2 with UNKNOWN_COMMAND and a Fix", () => {
  assert.equal(runCli([], fakeCtx([])).code, 0)
  const { code, text } = runCli(["frobnicate"], fakeCtx([]))
  assert.equal(code, 2)
  assert.match(text, /REFUSED UNKNOWN_COMMAND/)
  assert.match(text, /\nFix: /)
})

test("file --dry-run prints the guide and creates nothing", () => {
  const ctx = fakeCtx([])
  const { code, text } = runCli([...fileArgs, "--dry-run"], ctx)
  assert.equal(code, 0)
  assert.match(text, /DRY RUN/)
  assert.match(text, /How to write it/)
  assert.match(text, /Model issues to copy/)
  assert.match(text, /\nNext: /)
  assert.deepEqual(ctx.calls, [])
})

test("file creates the issue with the risk and type labels", () => {
  const ctx = fakeCtx([
    ["issue list", "[]"],
    ["issue create", "https://github.com/quanvu309/opencv/issues/77"],
  ])
  const { code, text } = runCli(fileArgs, ctx)
  assert.equal(code, 0)
  assert.match(text, /FILED #77/)
  assert.match(text, /new-task\.sh feat 77/)
  const create = ctx.calls.find((c) => c.includes("issue create"))
  assert.match(create, /--label risk:low --label feat/)
  assert.match(create, /--title feat: Keep my search/)
  const [body] = Object.values(ctx.written)
  assert.match(body, /### Type\n\nfeat\n\n### What and why/)
  assert.match(body, /### Risk\n\nlow/)
})

test("file for a high-risk issue says it needs the owner", () => {
  const ctx = fakeCtx([
    ["issue list", "[]"],
    ["issue create", "https://github.com/quanvu309/opencv/issues/78"],
  ])
  const args = [
    ...fileArgs.slice(0, -1),
    "high",
    "--could-go-wrong",
    "People could be locked out.",
  ]
  const { text } = runCli(args, ctx)
  assert.match(text, /label risk:high|Label: risk:high/)
  assert.match(text, /Next: Ask the owner to comment \/approve/)
})

test("file refuses jargon with exit 2 UNREADABLE and creates nothing", () => {
  const ctx = fakeCtx([])
  const args = fileArgs.map((a) =>
    a.startsWith("The page") ? "Add an API endpoint." : a
  )
  const { code, text } = runCli(args, ctx)
  assert.equal(code, 2)
  assert.match(text, /REFUSED UNREADABLE: .*jargon word "api"/)
  assert.match(text, /\nFix: /)
  assert.deepEqual(ctx.calls, [])
})

test("file refuses missing fields and high risk without --could-go-wrong", () => {
  const missing = runCli(["file", "--title", "feat: x"], fakeCtx([]))
  assert.equal(missing.code, 2)
  assert.match(missing.text, /MISSING_FIELDS: missing --what/)
  const high = runCli([...fileArgs.slice(0, -1), "high"], fakeCtx([]))
  assert.match(high.text, /missing --could-go-wrong/)
})

test("file adds the type prefix from --type and refuses a title with none", () => {
  const ctx = fakeCtx([
    ["issue list", "[]"],
    ["issue create", "https://x/issues/5"],
  ])
  const args = fileArgs.map((a) =>
    a === "feat: Keep my search" ? "Keep my search" : a
  )
  assert.equal(runCli([...args, "--type", "feat"], ctx).code, 0)
  assert.equal(runCli(args, fakeCtx([])).code, 2)
})

test("file does not file the same open title twice", () => {
  const ctx = fakeCtx([
    ["issue list", '[{"number":9,"title":"feat: Keep my search"}]'],
  ])
  const { code, text } = runCli(fileArgs, ctx)
  assert.equal(code, 0)
  assert.match(text, /ALREADY FILED: #9/)
  assert.ok(!ctx.calls.some((c) => c.includes("issue create")))
})

test("file lints a --body-file too", () => {
  const ctx = fakeCtx([], { "b.md": "### Risk\n\nlow\n" })
  const { code, text } = runCli(
    ["file", "--title", "feat: x", "--body-file", "b.md"],
    ctx
  )
  assert.equal(code, 2)
  assert.match(text, /UNREADABLE/)
})

const issueJson = (over = {}) =>
  JSON.stringify({
    data: {
      repository: {
        owner: { login: "quanvu309" },
        issue: {
          number: 90,
          title: "fix: Stop two emails",
          state: "OPEN",
          createdAt: "2026-10-29T10:00:00Z",
          lastEditedAt: null,
          labels: { nodes: [{ name: "fix" }, { name: "risk:high" }] },
          comments: { nodes: [] },
          ...over,
        },
      },
    },
  })

const statusRules = (issue, prs = "[]", worktrees = "") => [
  ["repo view", '{"owner":{"login":"quanvu309"},"name":"opencv"}'],
  ["api graphql", issue],
  ["pr list", prs],
  ["worktree list", worktrees],
  ["ls-remote", ""],
]

test("status of a high-risk issue without approval says to ask the owner", () => {
  const { code, text } = runCli(
    ["status", "90"],
    fakeCtx(statusRules(issueJson()))
  )
  assert.equal(code, 0)
  assert.match(text, /Risk: high/)
  assert.match(text, /Approval: NOT approved/)
  assert.match(text, /Next: Ask the owner to comment \/approve/)
})

test("status sees an owner /approve after the last edit", () => {
  const issue = issueJson({
    lastEditedAt: "2026-10-29T11:00:00Z",
    comments: {
      nodes: [
        {
          author: { login: "quanvu309" },
          body: "/approve",
          createdAt: "2026-10-29T12:00:00Z",
        },
        {
          author: { login: "someone" },
          body: "/approve",
          createdAt: "2026-10-29T13:00:00Z",
        },
      ],
    },
  })
  const { text } = runCli(["status", "90"], fakeCtx(statusRules(issue)))
  assert.match(text, /Approval: owner approved/)
  assert.match(text, /Next: scripts\/new-task\.sh fix 90/)
})

test("status shows branch, worktree and an open draft PR", () => {
  const worktrees = [
    "worktree /home/quan/projects/opencv.worktrees/90-two-emails",
    "HEAD abc",
    "branch refs/heads/fix/90-two-emails",
  ].join("\n")
  const prs =
    '[{"number":95,"state":"OPEN","isDraft":true,"headRefName":"fix/90-two-emails"},{"number":12,"state":"OPEN","isDraft":false,"headRefName":"fix/900-other"}]'
  const issue = issueJson({
    labels: { nodes: [{ name: "fix" }, { name: "risk:low" }] },
  })
  const { text } = runCli(
    ["status", "90"],
    fakeCtx(statusRules(issue, prs, worktrees))
  )
  assert.match(text, /Approval: not needed/)
  assert.match(
    text,
    /Branch: fix\/90-two-emails \(worktree \/home\/quan\/projects\/opencv\.worktrees\/90-two-emails\)/
  )
  assert.match(text, /Pull request: #95 open \(draft\)/)
  assert.match(text, /Next: scripts\/review-pr\.sh 95/)
})

test("status refuses a pull request number and a closed issue", () => {
  const rules = statusRules(issueJson())
  const notIssue = fakeCtx(
    rules.map(([m, r]) =>
      m === "api graphql"
        ? [m, () => ({ ok: false, out: "", err: "Could not resolve" })]
        : [m, r]
    )
  )
  const a = runCli(["status", "91"], notIssue)
  assert.equal(a.code, 2)
  assert.match(a.text, /REFUSED NOT_AN_ISSUE/)
  const closed = runCli(
    ["status", "90"],
    fakeCtx(statusRules(issueJson({ state: "CLOSED" })))
  )
  assert.equal(closed.code, 2)
  assert.match(closed.text, /REFUSED CLOSED/)
  assert.match(closed.text, /\nFix: /)
  assert.equal(runCli(["status"], fakeCtx([])).code, 1)
})

test("nextStep covers merged, branch-only and nothing started", () => {
  assert.match(
    nextStep({ n: 5, pr: { state: "MERGED" } }),
    /cleanup-worktree\.sh 5/
  )
  assert.match(
    nextStep({ n: 5, type: "feat", risk: "low", branch: "feat/5-x" }),
    /git worktree add/
  )
  assert.match(
    nextStep({ n: 5, type: "feat", risk: "low" }),
    /new-task\.sh feat 5/
  )
})

test("approvalValid needs the owner and a comment after the edit", () => {
  const owner = "quanvu309"
  const comment = (login, createdAt) => ({
    author: { login },
    body: "/approve please",
    createdAt,
  })
  const base = {
    owner,
    lastEditedAt: "2026-10-29T10:00:00Z",
    createdAt: "2026-10-28T10:00:00Z",
  }
  assert.equal(
    approvalValid({
      ...base,
      comments: [comment("QuanVu309", "2026-10-29T11:00:00Z")],
    }),
    true
  )
  assert.equal(
    approvalValid({
      ...base,
      comments: [comment(owner, "2026-10-29T09:00:00Z")],
    }),
    false
  )
  assert.equal(
    approvalValid({
      ...base,
      comments: [comment("other", "2026-10-29T11:00:00Z")],
    }),
    false
  )
  assert.equal(approvalValid({ ...base, comments: [] }), false)
})

const healthy = [
  ["auth status", "ok"],
  ["core.hooksPath", ".githooks"],
  [
    "label list",
    '[{"name":"risk:low"},{"name":"risk:normal"},{"name":"risk:high"}]',
  ],
]

test("doctor passes on a healthy machine", () => {
  const { code, text } = runCli(["doctor"], fakeCtx(healthy))
  assert.equal(code, 0)
  assert.match(text, /All checks pass/)
  assert.match(text, /\nNext: /)
})

test("doctor gives one Fix line per problem", () => {
  const ctx = fakeCtx([
    ["auth status", () => ({ ok: false, out: "", err: "not logged in" })],
    ["core.hooksPath", ""],
    ["label list", '[{"name":"risk:low"}]'],
  ])
  ctx.nodeVersion = "v18.0.0"
  const { code, text } = runCli(["doctor"], ctx)
  assert.equal(code, 1)
  const fixes = text.split("\n").filter((l) => l.startsWith("Fix: "))
  assert.equal(fixes.length, 5)
  assert.match(text, /Fix: Run: gh auth login/)
  assert.match(text, /Fix: Run: git config core\.hooksPath \.githooks/)
  assert.match(text, /risk:normal/)
  assert.match(text, /Fix: Install node 20/)
})

test("riskOf never fails open", async () => {
  const { riskOf } = await import("./report.mjs")
  assert.equal(riskOf(["risk:high", "risk:normal"]), "high")
  assert.equal(riskOf([], "### Risk\n\nhigh\n"), "high")
  assert.equal(riskOf(["risk:low"]), "low")
})
