import assert from "node:assert/strict"
import test from "node:test"
import {
  caughtBy,
  computeFriction,
  frictionWindow,
  renderFriction,
} from "./friction.mjs"
import { runCli } from "./cli.mjs"
import { ctxFor, fakePorts } from "./ports/fake.mjs"
import {
  blameOrigins,
  fetchFriction,
  parseCommits,
  replacedRanges,
} from "./ports/friction.mjs"

const window = { since: "2026-11-03T15:43:00Z", until: "2026-11-10T15:43:00Z" }
const before = "2026-11-03T15:42:59Z"
const during = "2026-11-06T12:00:00Z"
const after = "2026-11-10T15:43:01Z"
const files = (count) =>
  Array.from({ length: count }, (_, i) => ({
    path: `src/file${i}.mjs`,
    added: 1,
    generated: false,
  }))
const commit = (sha, subject, committerDate = during, origins = []) => ({
  sha,
  subject,
  committerDate,
  origins,
})
const pr = (number, title, body, mergedAt = during, changes = files(1)) => ({
  number,
  title,
  body,
  mergedAt,
  files: changes,
})
const run = (id, event, conclusion, createdAt = during, number = 1) => ({
  id,
  event,
  conclusion,
  createdAt,
  headBranch:
    event === "merge_group"
      ? `gh-readonly-queue/main/pr-${number}-abcdef`
      : `fix/${number}-work`,
  pullRequestNumbers: event === "pull_request" ? [number] : [],
})
const fixture = () => ({
  window,
  commits: [
    commit("a", "feat: start", window.since),
    commit("b", "fix: replace", during, [{ sha: "a", lines: 1 }]),
    commit("c", "HOTFIX: old code", window.until, [{ sha: "old", lines: 10 }]),
    commit("d", "fix: outside", before),
    commit("e", "fix: outside", after),
    commit("f", "fixture: no fix"),
  ],
  pullRequests: [
    pr(1, "fix: a", "Caught by: owner \u2014 found it", window.since),
    pr(2, "hotfix: b", "**Caught by:** CI \u2014 failed check", window.until),
    pr(3, "fix: c", "No attribution", during, files(26)),
    pr(4, "feat: d", "", during, [
      ...files(25),
      { path: "src/removed.mjs", added: 0 },
      { path: "x.test.mjs", added: 8 },
      { path: "drizzle/1.sql", added: 1 },
      { path: "pnpm-lock.yaml", added: 1 },
      { path: "src/generated.mjs", added: 9, generated: true },
    ]),
    pr(5, "fix: excluded", "Caught by: owner", after),
    pr(6, "fix: excluded", "Caught by: owner", before),
  ],
  runs: [
    run(1, "pull_request", "success", before),
    run(2, "pull_request", "failure", window.since),
    run(3, "pull_request", "cancelled"),
    run(4, "pull_request", "success", window.until),
    run(5, "merge_group", "failure"),
    run(6, "merge_group", "success"),
    run(7, "merge_group", "failure", during, 2),
    run(8, "pull_request", "success", after, 2),
    run(9, "push", "failure"),
    run(10, "merge_group", "failure", after),
  ],
})
const byId = (report, id) => report.rows.find((row) => row.id === id)

test("friction computes rows from dated commits, merged PRs and workflow events", () => {
  const report = computeFriction(fixture())
  for (const [id, count, total, value, met] of [
    ["fix_commits", 2, 4, 50, false],
    ["fix_prs", 3, 4, 75, false],
    ["same_week_repairs", 1, 2, 50, false],
    ["oversized_prs", 1, 4, 1, false],
    ["pr_ci_failures", 1, 3, 33.3333, false],
    ["queue_ci_failures", 2, 3, 66.6667, false],
    ["queue_failures_after_green", 1, 3, 33.3333, false],
    ["caught_owner", 1, 3, 33.3333, false],
    ["caught_ci", 1, 3, 33.3333, null],
    ["caught_unknown", 1, 3, 33.3333, false],
  ]) {
    const row = byId(report, id)
    assert.deepEqual(
      [row.count, row.total, row.value, row.met],
      [count, total, value, met],
      id
    )
  }
  assert.deepEqual(report.evidence.sameWeekRepairs, ["b"])
  assert.deepEqual(report.evidence.oversizedPrs, [
    { number: 3, countedSourceFiles: 26 },
  ])
  assert.deepEqual(report.evidence.queueFailuresAfterGreen, [5])
  assert.deepEqual(report.evidence.unknownCaughtBy, [3])
})

test("friction explicitly retains every unavailable hand-count category", () => {
  const report = computeFriction(fixture())
  for (const id of [
    "repair_count_decrease",
    "large_change_repairs",
    "design_parity_fixes",
    "pending_frames",
    "owner_nudges",
    "comments",
    "guard_proofs",
    "formal_mutants",
  ]) {
    const row = byId(report, id)
    assert.equal(row.value, null)
    assert.equal(row.met, null)
    assert.ok(row.reason.length > 20)
    assert.ok(renderFriction(report).includes(`${row.label} | not measured:`))
  }
})

test("friction is stable under input order, duplicate records, and repeated computation", () => {
  const input = fixture()
  const original = structuredClone(input)
  const expected = computeFriction(input)
  assert.deepEqual(input, original)
  assert.deepEqual(computeFriction(input), expected)
  for (const key of ["commits", "pullRequests", "runs"])
    input[key] = [...input[key], input[key][0]].reverse()
  assert.deepEqual(computeFriction(input), expected)
})

test("friction empty denominators remain unmeasured instead of reporting zero rates", () => {
  const report = computeFriction({
    window,
    commits: [],
    pullRequests: [],
    runs: [],
  })
  assert.deepEqual(
    [byId(report, "fix_commits").value, byId(report, "fix_commits").met],
    [null, null]
  )
  assert.equal(byId(report, "oversized_prs").value, 0)
  assert.match(renderFriction(report), /not measured \(empty denominator\)/)
})

test("friction compares targets before rounding and includes the green-queue limit", () => {
  const input = fixture()
  input.runs = [
    run(1, "pull_request", "success", before),
    run(2, "merge_group", "failure"),
    ...Array.from({ length: 49 }, (_, i) =>
      run(i + 3, "merge_group", "success")
    ),
  ]
  const report = computeFriction(input)
  assert.equal(byId(report, "queue_ci_failures").met, false)
  assert.equal(byId(report, "queue_failures_after_green").met, true)
})

test("friction keeps all repair origins, even when the in-window origin ranks fifth", () => {
  const input = fixture()
  input.commits[1].origins = ["old1", "old2", "old3", "old4", "a"].map(
    (sha, i) => ({ sha, lines: 5 - i })
  )
  assert.equal(byId(computeFriction(input), "same_week_repairs").count, 1)
})

test("friction attribution recognizes taxonomy labels and retains missing or unrecognized values", () => {
  for (const [line, expected] of [
    ["owner", "owner"],
    ["user", "owner"],
    ["review", "review"],
    ["CI", "ci"],
    ["verify-skill", "verify-skill"],
    ["verify-ui", "verify-skill"],
    ["agent-self", "agent-self"],
    ["agent", "agent-self"],
    ["test", "test"],
    ["unknown", "unknown"],
    ["somebody", "unknown"],
    ["", "unknown"],
  ])
    assert.equal(caughtBy(`Caught by: ${line}`), expected, line)
  assert.equal(caughtBy("Review saw the owner fix something"), "unknown")
  assert.equal(
    caughtBy("- **Caught by:** review \u2014 title says owner"),
    "review"
  )
})

test("friction validates timezone-qualified windows before reading sources", () => {
  assert.deepEqual(
    frictionWindow("2026-11-03T22:43:00+07:00", window.until),
    frictionWindow(window.since, window.until)
  )
  for (const since of [
    undefined,
    "yesterday",
    "2026-11-03",
    "2026-11-03T15:43:00",
    "2026-99-03T15:43:00Z",
    after,
  ])
    assert.throws(() => frictionWindow(since, window.until))
  for (const args of [
    [],
    ["--since"],
    ["--since", "--json"],
    ["--since", window.since, "--until"],
    ["--since", window.since, "--unti", window.until],
    ["--since", window.since, "extra"],
  ]) {
    const ports = fakePorts()
    ports.proc.run = () => assert.fail("bad arguments must not fetch")
    assert.notEqual(runCli(["friction", ...args], ctxFor(ports)).code, 0)
  }
  assert.match(
    runCli(["friction", "--help"], ctxFor(fakePorts())).text,
    /friction --since/
  )
})

test("friction parses committer dates, deleted ranges and porcelain blame deterministically", () => {
  const sha = "a".repeat(40)
  assert.deepEqual(parseCommits(`${sha}\x1f${during}\x1ffix: text\x1e\n`), [
    commit(sha, "fix: text"),
  ])
  assert.deepEqual(
    replacedRanges(
      "--- a/src/old name.mjs\n+++ b/src/new.mjs\n@@ -2,3 +2,1 @@\n@@ -9 +7 @@\n@@ -11,0 +10,5 @@"
    ),
    [
      { path: "src/old name.mjs", start: 2, count: 3 },
      { path: "src/old name.mjs", start: 9, count: 1 },
    ]
  )
  assert.deepEqual(blameOrigins(`${sha} 2 2 2\nauthor nobody\n${sha} 3 3\n`), [
    { sha, lines: 2 },
  ])
})

function fetchContext() {
  const calls = []
  const ctx = ctxFor(fakePorts())
  ctx.ports.gh.repo = () => ({ nameWithOwner: "owner/repo" })
  ctx.now = () => assert.fail("explicit --until must not read the clock")
  ctx.ports.proc.run = (cmd, args, options) => {
    calls.push({ cmd, args, options })
    const success = (value) => ({
      ok: true,
      out: typeof value === "string" ? value : JSON.stringify(value),
    })
    if (cmd === "git") {
      if (args[0] === "fetch") return success("")
      if (args[0] === "rev-parse") return success("tip")
      if (args[0] === "log") return success(`abc\x1f${during}\x1ffeat: a\x1e`)
      if (args[0] === "check-attr")
        return success("src/a.mjs\0linguist-generated\0unspecified\0")
    }
    if (cmd === "gh") {
      if (args[0] === "pr" && args[1] === "list")
        return success([
          {
            number: 1,
            title: "fix: a",
            body: "Caught by: test",
            mergedAt: during,
            mergeCommit: { oid: "abc" },
            headRefName: "fix/1-work",
            changedFiles: 1,
          },
        ])
      const route = args[1]
      if (route.includes("pulls/1/files"))
        return success([{ filename: "src/a.mjs", additions: 1 }])
      if (route.includes("event=merge_group"))
        return success({
          total_count: 1,
          workflow_runs: [
            {
              id: 2,
              event: "merge_group",
              conclusion: "failure",
              created_at: during,
              head_branch: "gh-readonly-queue/main/pr-1-abc",
            },
          ],
        })
      if (route.includes("branch=fix%2F1-work"))
        return success({
          total_count: 1,
          workflow_runs: [
            {
              id: 1,
              event: "pull_request",
              conclusion: "success",
              created_at: before,
              head_branch: "fix/1-work",
              pull_requests: [],
            },
          ],
        })
      if (route.includes("event=pull_request"))
        return success({ total_count: 0, workflow_runs: [] })
    }
    assert.fail(`unexpected ${cmd} ${args.join(" ")}`)
  }
  return { ctx, calls }
}

test("friction CLI emits parseable JSON with no clock reads and joins queue refs to PR branches", () => {
  const { ctx, calls } = fetchContext()
  const result = runCli(
    ["friction", "--since", window.since, "--until", window.until, "--json"],
    ctx
  )
  assert.equal(result.code, 0, result.text)
  const report = JSON.parse(result.text)
  assert.equal(byId(report, "queue_failures_after_green").count, 1)
  assert.equal(byId(report, "pr_ci_failures").total, 0)
  assert.ok(
    calls.some(
      ({ args }) =>
        args[0] === "log" &&
        args.includes(`--since-as-filter=${report.window.since}`)
    )
  )
  assert.ok(
    calls.some(
      ({ args }) => args[0] === "check-attr" && args.includes("--source=abc")
    )
  )
  assert.ok(
    calls.every(({ args }) => !args.includes("exclude_pull_requests=true"))
  )
})

test("friction refuses incomplete GitHub data and failed commands", () => {
  for (const mode of ["failed-command", "file-count", "run-cap", "pr-cap"]) {
    const { ctx } = fetchContext()
    const original = ctx.ports.proc.run
    ctx.ports.proc.run = (cmd, args, options) => {
      if (mode === "failed-command")
        return { ok: false, err: "network unavailable" }
      const result = original(cmd, args, options)
      if (cmd !== "gh") return result
      if (mode === "file-count" && args[1].includes("pulls/1/files"))
        result.out = "[]"
      if (mode === "run-cap" && args[1].includes("event=pull_request"))
        result.out = JSON.stringify({ total_count: 1001, workflow_runs: [] })
      if (mode === "pr-cap" && args[0] === "pr" && args[1] === "list")
        result.out = JSON.stringify(
          Array.from({ length: 1000 }, (_, number) => ({ number }))
        )
      return result
    }
    assert.throws(
      () => fetchFriction(ctx, frictionWindow(window.since, window.until)),
      /failed|incomplete|1000/,
      mode
    )
  }
})
