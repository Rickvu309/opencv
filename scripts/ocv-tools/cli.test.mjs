import assert from "node:assert/strict"
import test from "node:test"
import { isMissingFlagValue, runCli } from "./cli.mjs"
import { nextStep } from "./report.mjs"
import { ctxFor, fakePorts, issue } from "./ports/fake.mjs"

function run(over = {}, extra = {}) {
  const ports = fakePorts({ ...over, ...extra })
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
  for (const word of ["file", "take", "doctor", "UNKNOWN_COMMAND"])
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

test("file for a high-risk issue is ready to take", () => {
  const { ctx } = run({ issues: [], nextIssue: 78 })
  const args = [
    ...fileArgs.slice(0, -1),
    "high",
    "--could-go-wrong",
    "People could be locked out.",
  ]
  const { text } = runCli(args, ctx)
  assert.match(text, /label risk:high|Label: risk:high/)
  assert.match(text, /Next: scripts\/ocv-tools\.mjs take 78/)
})

test("file accepts everyday words in the title and warns about them in the body", () => {
  const { ctx } = run({ issues: [], nextIssue: 80 })
  const titled = fileArgs.map((a) =>
    a === "feat: Keep my search" ? "fix: Keep CI honest" : a
  )
  const ok = runCli(titled, ctx)
  assert.equal(ok.code, 0, ok.text)
  const body = runCli(
    fileArgs.map((a) => (a.startsWith("The page") ? "The CI run lied." : a)),
    run({ issues: [] }).ctx
  )
  assert.equal(body.code, 0, body.text)
  assert.match(body.text, /FILED #/)
  assert.match(body.text, /Warning: .*jargon word "ci"/)
})

test("file warns about jargon, long sentences and reading grade and still files", () => {
  const { ports, ctx } = run({ issues: [], nextIssue: 81 })
  const long = `Add an API endpoint ${Array.from({ length: 22 }, () => "word").join(" ")}.`
  const args = fileArgs.map((a) => (a.startsWith("The page") ? long : a))
  const { code, text } = runCli(args, ctx)
  assert.equal(code, 0, text)
  assert.match(text, /FILED #81/)
  assert.match(text, /Warning: .*jargon word "api"/)
  assert.match(text, /Warning: .*-word sentence/)
  assert.doesNotMatch(text, /REFUSED/)
  assert.ok(ports.effects.some((e) => e.op === "createIssue"))
})

test("file still refuses code formatting with exit 2 UNREADABLE and creates nothing", () => {
  const { ports, ctx } = run({ issues: [] })
  const args = fileArgs.map((a) =>
    a.startsWith("The page") ? "Change `search` please." : a
  )
  const { code, text } = runCli(args, ctx)
  assert.equal(code, 2)
  assert.match(text, /REFUSED UNREADABLE: .*code formatting/)
  assert.match(text, /\nFix: /)
  assert.deepEqual(ports.effects, [])
})

test("take with a title names every missing flag at once with a command to copy", () => {
  const { ports, ctx } = run({ issues: [] })
  const { code, text } = runCli(
    ["take", "Keep my search", "-d", "keep search", "--risk", "huge"],
    ctx
  )
  assert.equal(code, 2, text)
  assert.match(
    text,
    /REFUSED MISSING_FIELDS: the title must start with one of .*; missing --what, --done; --risk must be low, normal, high, not "huge"/
  )
  assert.match(
    text,
    /\nFix: Fill in what is missing and run: scripts\/ocv-tools\.mjs take 'Keep my search' -d 'keep search' --type '<feat\|fix\|hotfix\|refactor\|chore\|docs>' --what '<What and why>' --done '<Done when>' --risk '<low\|normal\|high>'/
  )
  assert.deepEqual(ports.effects, [])
})

test("the command to copy keeps what was already given", () => {
  const { ctx } = run({ issues: [] })
  const { text } = runCli(
    [
      "file",
      "--title",
      "fix: Keep it's search",
      "--what",
      "The page forgets.",
      "--risk",
      "high",
    ],
    ctx
  )
  assert.match(
    text,
    /MISSING_FIELDS: missing --done; missing --could-go-wrong \(required when risk is high\)/
  )
  assert.ok(
    text.includes(
      `scripts/ocv-tools.mjs file --title 'fix: Keep it'\\''s search' --what 'The page forgets.' --done '<Done when>' --risk high --could-go-wrong '<What could go wrong>'`
    ),
    text
  )
})

test("--help on a command prints its usage and changes nothing", () => {
  for (const [args, usage] of [
    [["take", "--help"], /Usage: scripts\/ocv-tools\.mjs take <n \| title>/],
    [["take", "90", "-h"], /Usage: scripts\/ocv-tools\.mjs take <n \| title>/],
    [["finish", "--help"], /Usage: scripts\/ocv-tools\.mjs finish --body-file/],
    [["save", "--help"], /Usage: scripts\/ocv-tools\.mjs save -m/],
  ]) {
    const { ports, ctx } = run()
    const { code, text } = runCli(args, ctx)
    assert.equal(code, 0, text)
    assert.match(text, usage)
    assert.match(text, /\nNext: scripts\/ocv-tools\.mjs help/)
    assert.deepEqual(ports.effects, [])
  }
  assert.match(
    runCli(["--help"], run().ctx).text,
    /Usage: scripts\/ocv-tools\.mjs <command>/
  )
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

test("a flag value that starts with a dash and a space is prose, while a missing value or another flag is not a value", () => {
  assert.equal(isMissingFlagValue("- I fix the save"), false)
  assert.equal(isMissingFlagValue("-5 degrees"), false)
  assert.equal(isMissingFlagValue(undefined), true)
  assert.equal(isMissingFlagValue("--risk"), true)
  assert.equal(isMissingFlagValue("-d"), true)
})
