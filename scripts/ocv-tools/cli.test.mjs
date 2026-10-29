import assert from "node:assert/strict"
import test from "node:test"
import { runCli } from "./cli.mjs"
import { approvalValid, nextStep } from "./report.mjs"
import { ctxFor, fakePorts, issue, pr } from "./ports/fake.mjs"

function run(over = {}, extra = {}) {
  const ports = fakePorts(over)
  return { ports, ctx: ctxFor(ports, extra) }
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

test("take refuses bad arguments before any git or gh call", () => {
  const check = (args, code, pattern) => {
    const { ports, ctx } = run()
    const r = runCli(["take", ...args], ctx)
    assert.equal(r.code, 2, `${args.join(" ")} -> ${r.text}`)
    assert.match(r.text, new RegExp(`REFUSED ${code}`))
    assert.match(r.text, /\nFix: /)
    assert.deepEqual(ports.effects, [])
    if (pattern) assert.match(r.text, pattern)
  }
  check(["90", "--no-asign"], "UNKNOWN_FLAG", /unknown option: --no-asign/)
  check(
    ["90", "--desc", "chosen branch words"],
    "UNKNOWN_FLAG",
    /unknown option: --desc \(use -d\)/
  )
  check(["90", "-b", "body text"], "UNKNOWN_FLAG", /--body-file/)
  check(["90", "--help"], "UNKNOWN_FLAG", /help/)
  check(["90", "-d"], "MISSING_FIELDS", /-d needs a value/)
  check(["90", "--type"], "MISSING_FIELDS", /--type needs a value/)
  check(["90", "-d", "--no-assign"], "MISSING_FIELDS", /-d needs a value/)
  check(["90", "--type", "feature"], "MISSING_FIELDS", /type must be one of/)
  check(["0"], "BAD_ISSUE", /not an issue number/)
  check(["#0"], "BAD_ISSUE")
  check(["90.5"], "BAD_ISSUE")
  check(["#abc"], "BAD_ISSUE")
  check(["90", "Cart total rounds wrong"], "BAD_ARGS", /not both/)
  check(["90", "-d", ""], "MISSING_FIELDS", /no usable characters/)
  check(["90", "-d", "!!!"], "MISSING_FIELDS", /no usable characters/)
})

test("help lists the jobs and ends with Next", () => {
  const { code, text } = runCli(["help"], run().ctx)
  assert.equal(code, 0)
  for (const word of ["file", "status", "doctor", "UNKNOWN_COMMAND", "LOST"])
    assert.ok(text.includes(word), word)
  assert.match(text, /\nNext: /)
})

test("no command shows help; an unknown command exits 2 with UNKNOWN_COMMAND and a Fix", () => {
  assert.equal(runCli([], run().ctx).code, 0)
  const { code, text } = runCli(["frobnicate"], run().ctx)
  assert.equal(code, 2)
  assert.match(text, /REFUSED UNKNOWN_COMMAND/)
  assert.match(text, /\nFix: /)
})

test("file --dry-run prints the guide and creates nothing", () => {
  const { ports, ctx } = run({ issues: [] })
  const { code, text } = runCli([...fileArgs, "--dry-run"], ctx)
  assert.equal(code, 0)
  assert.match(text, /DRY RUN/)
  assert.match(text, /How to write it/)
  assert.match(text, /Model issues to copy/)
  assert.match(text, /\nNext: /)
  assert.deepEqual(ports.effects, [])
})

test("file creates the issue with the risk and type labels", () => {
  const { ports, ctx } = run({ issues: [], nextIssue: 77 })
  const { code, text } = runCli(fileArgs, ctx)
  assert.equal(code, 0)
  assert.match(text, /FILED #77/)
  assert.match(text, /ocv-tools\.mjs take 77/)
  const created = ports.effects.find((e) => e.op === "createIssue")
  assert.equal(created.title, "feat: Keep my search")
  assert.deepEqual(created.labels, ["risk:low", "feat"])
  const body = Object.values(ctx.written)[0]
  assert.match(body, /### Type\n\nfeat\n\n### What and why/)
  assert.match(body, /### Risk\n\nlow/)
})

test("file for a high-risk issue says it needs the owner", () => {
  const { ctx } = run({ issues: [], nextIssue: 78 })
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
  const { ports, ctx } = run({ issues: [] })
  const args = fileArgs.map((a) =>
    a.startsWith("The page") ? "Add an API endpoint." : a
  )
  const { code, text } = runCli(args, ctx)
  assert.equal(code, 2)
  assert.match(text, /REFUSED UNREADABLE: .*jargon word "api"/)
  assert.match(text, /\nFix: /)
  assert.deepEqual(ports.effects, [])
})

test("file refuses missing fields and high risk without --could-go-wrong", () => {
  const missing = runCli(
    ["file", "--title", "feat: x"],
    run({ issues: [] }).ctx
  )
  assert.equal(missing.code, 2)
  assert.match(missing.text, /MISSING_FIELDS: missing --what/)
  const high = runCli(
    [...fileArgs.slice(0, -1), "high"],
    run({ issues: [] }).ctx
  )
  assert.match(high.text, /missing --could-go-wrong/)
})

test("file adds the type prefix from --type and refuses a title with none", () => {
  const { ctx } = run({ issues: [], nextIssue: 5 })
  const args = fileArgs.map((a) =>
    a === "feat: Keep my search" ? "Keep my search" : a
  )
  assert.equal(runCli([...args, "--type", "feat"], ctx).code, 0)
  assert.equal(runCli(args, run({ issues: [] }).ctx).code, 2)
})

test("file does not file the same open title twice", () => {
  const { ports, ctx } = run({
    issues: [issue(9, { title: "feat: Keep my search" })],
  })
  const { code, text } = runCli(fileArgs, ctx)
  assert.equal(code, 0)
  assert.match(text, /ALREADY FILED: #9/)
  assert.ok(!ports.effects.some((e) => e.op === "createIssue"))
})

test("file lints a --body-file too", () => {
  const { ctx } = run({ files: { "b.md": "### Risk\n\nlow\n" } })
  const { code, text } = runCli(
    ["file", "--title", "feat: x", "--body-file", "b.md"],
    ctx
  )
  assert.equal(code, 2)
  assert.match(text, /UNREADABLE/)
})

test("status of a high-risk issue without approval says to ask the owner", () => {
  const { code, text } = runCli(
    ["status", "90"],
    run({
      owner: "quanvu309",
      issues: [
        issue(90, {
          title: "fix: Stop two emails",
          labels: ["fix", "risk:high"],
          createdAt: "2026-10-29T10:00:00Z",
        }),
      ],
    }).ctx
  )
  assert.equal(code, 0)
  assert.match(text, /Risk: high/)
  assert.match(text, /Approval: NOT approved/)
  assert.match(text, /Next: Ask the owner to comment \/approve/)
})

test("status sees an owner /approve after the last edit", () => {
  const { text } = runCli(
    ["status", "90"],
    run({
      owner: "quanvu309",
      issues: [
        issue(90, {
          title: "fix: Stop two emails",
          labels: ["fix", "risk:high"],
          createdAt: "2026-10-29T10:00:00Z",
          lastEditedAt: "2026-10-29T11:00:00Z",
          comments: [
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
        }),
      ],
    }).ctx
  )
  assert.match(text, /Approval: owner approved/)
  assert.match(text, /Next: scripts\/ocv-tools\.mjs take 90/)
})

test("status shows branch, worktree and an open draft PR", () => {
  const { ports, ctx } = run({
    issues: [
      issue(90, {
        title: "fix: Stop two emails",
        labels: ["fix", "risk:low"],
      }),
    ],
    worktrees: [
      {
        path: "/home/quan/projects/opencv.worktrees/90-two-emails",
        branch: "fix/90-two-emails",
      },
    ],
    prs: [
      pr(95, { isDraft: true, head: "fix/90-two-emails" }),
      pr(12, { head: "fix/900-other" }),
    ],
  })
  const { text } = runCli(["status", "90"], ctx)
  assert.match(text, /Approval: not needed/)
  assert.match(
    text,
    /Branch: fix\/90-two-emails \(worktree \/home\/quan\/projects\/opencv\.worktrees\/90-two-emails\)/
  )
  assert.match(text, /Pull request: #95 open \(draft\)/)
  assert.match(
    text,
    /Next: gh pr ready 95, then scripts\/merge-pr\.sh 95 once ci is green/
  )
  assert.equal(ports.counts.issue, 1)
  assert.equal(ports.counts.worktrees, 1)
  assert.equal(ports.counts.prs, 1)
  assert.equal(ports.counts.remoteHeads, 0)
})

test("status refuses a pull request number and a closed issue", () => {
  const a = runCli(["status", "91"], run().ctx)
  assert.equal(a.code, 2)
  assert.match(a.text, /REFUSED NOT_AN_ISSUE/)
  const closed = runCli(
    ["status", "90"],
    run({
      issues: [issue(90, { title: "fix: Stop two emails", state: "CLOSED" })],
    }).ctx
  )
  assert.equal(closed.code, 2)
  assert.match(closed.text, /REFUSED CLOSED/)
  assert.match(closed.text, /\nFix: /)
  assert.equal(runCli(["status"], run().ctx).code, 1)
})

test("nextStep covers merged, branch-only and nothing started", () => {
  assert.match(
    nextStep({ n: 5, pr: { state: "MERGED" } }),
    /ocv-tools\.mjs cleanup 5/
  )
  assert.match(
    nextStep({ n: 5, type: "feat", risk: "low", branch: "feat/5-x" }),
    /git worktree add/
  )
  assert.match(
    nextStep({ n: 5, type: "feat", risk: "low" }),
    /ocv-tools\.mjs take 5/
  )
})

test("approvalValid accepts only an approver after the issue's last edit", () => {
  const owner = "quanvu309"
  const comment = (login, createdAt) => ({
    author: { login },
    body: "/approve please",
    createdAt,
  })
  const base = {
    approvers: [owner],
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
  assert.equal(
    approvalValid({
      ...base,
      approvers: [],
      comments: [comment(owner, "2026-10-29T11:00:00Z")],
    }),
    false
  )
  assert.equal(
    approvalValid({
      ...base,
      approvers: ["admin-person"],
      comments: [comment("ADMIN-PERSON", "2026-10-29T11:00:00Z")],
    }),
    true
  )
  assert.equal(
    approvalValid({
      ...base,
      approvers: ["admin-person"],
      comments: [comment("member", "2026-10-29T11:00:00Z")],
    }),
    false
  )
})

test("doctor passes on a healthy machine", () => {
  const { code, text } = runCli(["doctor"], run().ctx)
  assert.equal(code, 0)
  assert.match(text, /All checks pass/)
  assert.match(text, /\nNext: /)
})

test("doctor gives one Fix line per problem", () => {
  const { ctx } = run(
    {
      authed: false,
      hooksPath: "",
      labels: ["risk:low"],
    },
    { nodeVersion: "v18.0.0" }
  )
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
