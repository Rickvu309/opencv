import assert from "node:assert/strict"
import test from "node:test"
import { runCli } from "./cli.mjs"
import { ctxFor, fakePorts } from "./ports/fake.mjs"
import { COMMANDS } from "./report.mjs"
import { decide, evaluate, jobRows, needsOf, RULES } from "./rules/index.mjs"

const TYPE_LIST = "feat, fix, hotfix, refactor, chore, docs"
const seen = new Set()

function check(id, bad, good, message) {
  const row = RULES.find((item) => item.id === id)
  assert.ok(row?.check, id)
  assert.equal(row.check(bad), message, id)
  assert.equal(row.check(good), null, id)
  const hit = evaluate(id, bad)
  assert.equal(hit.id, id)
  assert.equal(hit.message, message)
  assert.equal(typeof hit.fix, "string")
  assert.ok(hit.fix.length > 0, id)
  seen.add(id)
}

test("every checked rule has a failing and a passing fact", () => {
  check(
    "NOT_A_TASK",
    { here: { ok: false } },
    { here: { ok: true } },
    "this folder is not a linked task worktree under ../opencv.worktrees on branch type/<n>-description"
  )
  check(
    "NOT_AN_ISSUE",
    { issue: { n: 91, missing: true } },
    { issue: { n: 91, state: "OPEN" } },
    "#91 is not an issue"
  )
  check(
    "UNKNOWN",
    { history: { kind: "stuck", n: 90 } },
    { history: { kind: "complete" } },
    "claim history for #90 stopped before the first comment (the page cursor did not move)"
  )
  check(
    "CLOSED",
    { issue: { n: 90, state: "CLOSED" } },
    { issue: { n: 90, state: "OPEN" } },
    "#90 is closed"
  )
  check(
    "READY_FOR_HUMAN",
    { issue: { n: 90, labels: ["ready-for-human"] } },
    { issue: { n: 90, labels: [] } },
    "#90 is labeled ready-for-human: it is a decision for a human, never an agent task"
  )
  check(
    "HELD",
    {
      issue: { n: 90 },
      claim: { state: "live", agent: "a1", idleMinutes: 30 },
      me: "me",
    },
    {
      issue: { n: 90 },
      claim: { state: "live", agent: "me", idleMinutes: 1 },
      me: "me",
    },
    "#90 is held by a1 (last saved 30 min ago; free after 180)"
  )
  check(
    "ASSIGNED",
    { issue: { n: 90, assignees: ["someone"] }, login: "me", flags: {} },
    { issue: { n: 90, assignees: ["Me"] }, login: "me", flags: {} },
    "#90 is assigned to someone; pick another issue, or pass --take if this is agreed"
  )
  check(
    "NOT_OWNER",
    { issue: { n: 90 }, claim: { state: "live", agent: "a1" }, me: "me" },
    { issue: { n: 90 }, claim: { state: "idle", agent: "me" }, me: "me" },
    "you (me) do not hold #90; a1 does"
  )
  check(
    "LOST",
    { issue: { n: 90 }, claim: { state: "live", agent: "a1" }, me: "me" },
    { issue: { n: 90 }, claim: { state: "live", agent: "me" }, me: "me" },
    "a1 holds the claim now"
  )
  check(
    "WORKTREE_EXISTS",
    {
      issue: { n: 90 },
      local: { worktree: "/wt/90", branch: "feat/90-keep" },
      path: null,
    },
    { issue: { n: 90 }, local: {}, path: null },
    "#90 already has a worktree: /wt/90 (feat/90-keep)"
  )
  check(
    "NO_WORKTREE",
    {
      local: {
        required: true,
        found: false,
        n: 90,
        root: "/tmp/opencv.worktrees",
      },
    },
    { local: { required: true, found: true } },
    "#90 has no local worktree under /tmp/opencv.worktrees to clean up"
  )
  check(
    "DIRTY",
    {
      work: {
        path: "/wt/90",
        dirty: " M x.txt",
        branch: "feat/90-keep",
        merged: true,
      },
    },
    { work: { path: "/wt/90", dirty: "", force: false, merged: true } },
    "/wt/90 has unsaved work:  M x.txt"
  )
  check(
    "NOT_MERGED",
    { work: { branch: "feat/90-keep", merged: false } },
    { work: { branch: "feat/90-keep", merged: true } },
    "feat/90-keep has no merged pull request or explicitly abandoned closed pull request"
  )
  check(
    "MISSING_FIELDS",
    { flags: {}, missingValue: "-d" },
    { flags: {} },
    "-d needs a value"
  )
  check(
    "UNREADABLE",
    { draft: { reasons: ["too long", "jargon"] } },
    { draft: { reasons: [] } },
    "too long; jargon"
  )
  check(
    "DISK",
    {
      disk: {
        text: "only 1 MiB free on the filesystem of /tmp, need 2048 MiB",
        cause: "disk",
      },
    },
    { disk: {} },
    "only 1 MiB free on the filesystem of /tmp, need 2048 MiB"
  )
  check(
    "BRANCH_EXISTS",
    {
      branch: { stage: "create", name: "feat/90-keep-my-search", local: true },
      issue: { n: 90 },
    },
    { branch: { stage: "later" }, issue: { n: 90 } },
    "branch feat/90-keep-my-search already exists locally (git worktree list)"
  )
  check(
    "DIVERGED",
    {
      branch: { name: "feat/90-keep-my-search", relation: "diverged" },
      issue: { n: 90 },
    },
    { branch: { stage: "later" }, issue: { n: 90 } },
    "local feat/90-keep-my-search and origin/feat/90-keep-my-search have diverged, so resume would keep the stale local history"
  )
  check(
    "NOT_A_REPO",
    { repo: { missing: true } },
    { repo: { ok: true } },
    "run this inside the opencv repository"
  )
  check(
    "UNKNOWN_COMMAND",
    { command: { name: "nope", names: "help, file" } },
    { command: { known: true } },
    'no command "nope"; commands are help, file'
  )
  check(
    "UNKNOWN_FLAG",
    { flag: { name: "--no-asign" } },
    { flag: { known: true } },
    "unknown option: --no-asign"
  )
  check(
    "BAD_ARGS",
    { args: { both: true } },
    { args: { ok: true } },
    "pass an issue number or a title, not both"
  )
  check(
    "BAD_ISSUE",
    { token: { text: "0" } },
    { token: { ok: true } },
    '"0" is not an issue number'
  )
  check(
    "MAIN_CLEAN",
    { main: { path: "/repo", readable: false } },
    { main: { path: "/repo", branch: "main", dirty: "" } },
    "the main checkout (/repo) cannot be read as a git checkout; it stays on main and nobody works in it"
  )
  check(
    "PORT",
    {
      port: { recorded: true, worktree: "/wt", env: "4001", assigned: "4090" },
    },
    { port: { recorded: false } },
    "PORT in /wt/.env is '4001', but ocv-tools take assigned port 4090 to this worktree; use only your assigned port"
  )
  check(
    "NO_WORKFLOWS",
    { diff: { files: [".github/workflows/extra.yml"] } },
    { diff: { files: [".github/workflows/ci.yml"] } },
    "workflows other than ci.yml and nightly.yml are not added without an issue: .github/workflows/extra.yml"
  )
  check(
    "NO_WORKFLOWS",
    { diff: { files: [".github/workflows/another.yml"] } },
    { diff: { files: [".github/actions/setup/action.yml"] } },
    "workflows other than ci.yml and nightly.yml are not added without an issue: .github/workflows/another.yml"
  )
  check(
    "RISK_HIGH_FOR_CI",
    { diff: { files: [".github/actions/setup/action.yml"], labels: [] } },
    {
      diff: {
        files: [".github/actions/setup/action.yml"],
        labels: ["risk:high"],
      },
    },
    "the change touches ci.yml, nightly.yml, composite actions, check.mjs or the main ruleset, which attest the ci check itself, and the issue is not labeled risk:high"
  )
  check(
    "CI_WORKFLOW_KEPT",
    { diff: { files: ".github/workflows/ci.yml", ciYmlAtHead: false } },
    { diff: { files: ".github/workflows/ci.yml", ciYmlAtHead: true } },
    "the change deletes .github/workflows/ci.yml: the file may change, never vanish (the required ci check runs from it)"
  )
  check(
    "RISK_HIGH_FOR_CI",
    { diff: { files: ["scripts/check.mjs"], labels: ["risk:low"] } },
    { diff: { files: ["scripts/check.mjs"], labels: ["risk:high"] } },
    "the change touches ci.yml, nightly.yml, composite actions, check.mjs or the main ruleset, which attest the ci check itself, and the issue is not labeled risk:high"
  )
  check(
    "SKIP_DECLARED",
    { env: { SKIP_CHECKS: "1" } },
    { env: { SKIP_CHECKS: "1", SKIP_CHECKS_DECLARED_BY: "Ada" } },
    "SKIP_CHECKS=1 is for a production emergency a human declared; no human is named"
  )
  check(
    "NO_AI_ATTRIBUTION",
    { commits: { trailers: "abc1234 " } },
    { commits: {} },
    "commit(s) abc1234 carry an attribution trailer, which the commit-msg hook refuses: they were made without that hook (the hook-skip flag, a cherry-pick or a rebase)"
  )
  check(
    "NO_AI_ATTRIBUTION",
    { commits: { trailers: "this message" } },
    { commits: { trailers: "" } },
    "the commit message carries an attribution trailer"
  )
  check(
    "ON_MAIN",
    { commit: { branch: "main", first: "x" } },
    { commit: { branch: "feat/1-x", first: "x" } },
    "committing on main is not allowed; work on a task branch in your own worktree"
  )
  check(
    "EMPTY_MESSAGE",
    { commit: { branch: "feat/1-x", first: "" } },
    { commit: { branch: "feat/1-x", first: null } },
    "the commit message has no first line"
  )
  check(
    "NO_PUSH_MAIN",
    { push: { refs: [{ branch: "main", deleting: false }] } },
    { push: { refs: [{ branch: "feat/1-x", deleting: false }] } },
    "pushing to main is not allowed"
  )
  check(
    "BRANCH_NAME",
    { push: { refs: [{ branch: "bad-name", deleting: false }] } },
    {
      push: {
        refs: [
          { branch: "bad-name", deleting: true },
          { branch: "dependabot/npm/x", deleting: false },
        ],
      },
    },
    `branch 'bad-name' does not match type/<issue#>-short-description (types: ${TYPE_LIST})`
  )
  check(
    "QUICK_CHECKS",
    { quick: { failed: ["no-comments", "fast guards"] } },
    { quick: { failed: [] } },
    "the quick checks failed: no-comments, fast guards"
  )
  check(
    "FILE_SIZE",
    { commits: { oversize: "big.mjs (20001 bytes) " } },
    { commits: {} },
    "file(s) over the 20000-byte limit (5000 tokens): big.mjs (20001 bytes)"
  )
  check(
    "MISSING_FILE",
    { pictures: [{ path: "a.png", exists: false }] },
    { pictures: [{ path: "a.png", exists: true }] },
    "a.png does not exist"
  )
  check(
    "BAD_PICTURE",
    { pictures: [{ path: "a.txt", bytesChecked: false }] },
    { pictures: [{ path: "a.png", type: "png" }] },
    "a.txt is not a png, jpg, gif or webp (checked the file bytes)"
  )
  check(
    "TOO_BIG",
    { pictures: [{ path: "a.png", bytes: 10 * 1024 * 1024 + 1 }] },
    { pictures: [{ path: "a.png", bytes: 100 }] },
    "a.png is over 10 MB"
  )
  check(
    "TOO_MANY",
    { shot: { count: 21 } },
    { shot: { count: 20 } },
    "shot takes at most 20 pictures per run (21 given)"
  )
  check(
    "NO_BEFORE_AFTER",
    {
      pull: { body: "## Summary\n\nx" },
      diff: { files: ["packages/ui/src/components/button.tsx"] },
    },
    {
      pull: {
        body: "## Before / after\n\nNo visible change.\nThe rename keeps every style as it was.",
      },
      diff: { files: ["packages/ui/src/components/button.tsx"] },
    },
    "the change edits 1 screen file(s) (packages/ui/src/components/button.tsx) but the PR body has no ## Before / after section"
  )
  for (const row of jobRows) seen.add(row.id)
  check(
    "CHANGE_TOO_BIG",
    {
      diff: {
        changes: Array.from({ length: 26 }, (_, i) => ({
          path: `a${i}.ts`,
          added: 1,
          deleted: 0,
        })),
      },
    },
    { diff: { changes: [{ path: "a.ts", added: 1, deleted: 0 }] } },
    "the change adds or edits 26 authored source files (limit 25); large changes cause most of our bugs, so split it into sub-issues (AGENTS.md section 1) and ship one part at a time"
  )
  check(
    "PR_METADATA",
    {
      pull: { issue: 9, title: "feat: x (#9)", body: "x", issueState: "OPEN" },
    },
    { pull: { issue: 9, title: "feat: x (#9)", body: "Closes #9" } },
    'the pull request details are wrong: the body has no "Closes #9" line'
  )
  const pinned = (pin, body = "Closes #9") => ({
    pull: { issue: 9, body, closing: [9] },
    pins: [{ at: "apps/api/src/a.test.ts:4", ...pin }],
  })
  check(
    "PIN_ISSUE_OPEN",
    pinned({ issue: 9, state: "OPEN" }),
    pinned({ issue: 12, state: "OPEN" }),
    "an expected failure (it.fails) must cite an issue that stays open after this merge: apps/api/src/a.test.ts:4 cites #9, which this pull request closes"
  )
  const pinnedAt = (pin, body) =>
    RULES.find((row) => row.id === "PIN_ISSUE_OPEN").check(pinned(pin, body))
  assert.match(
    pinnedAt({ issue: 12, state: "CLOSED" }),
    /cites #12, which is closed$/
  )
  assert.match(
    pinnedAt({ issue: 12, state: "OPEN" }, "Closes #9\nFixes #12"),
    /cites #12, which this pull request closes$/
  )
  assert.match(
    pinnedAt({ issue: null, state: null }),
    /a\.test\.ts:4 names no issue$/
  )
  assert.match(pinnedAt({ issue: 12, state: "MISSING" }), /which is missing$/)
  for (const row of RULES) {
    if (!row.check) {
      assert.equal(row.kind, "judgment", row.id)
      assert.ok(row.why, row.id)
      assert.equal(row.fix({}), "None")
      continue
    }
    assert.ok(seen.has(row.id), `no fixture for ${row.id}`)
  }
})

test("variant messages stay the ones the jobs print", () => {
  const at = (id, facts) => RULES.find((row) => row.id === id).check(facts)
  assert.equal(
    at("UNKNOWN", { history: { kind: "cap", n: 4, pageCap: 100 } }),
    "claim history for #4 is incomplete: 100 pages were read and older comments remain"
  )
  assert.equal(
    at("CLOSED", {
      issue: { n: 90, state: "CLOSED" },
      pr: { current: { state: "MERGED" } },
    }),
    null
  )
  assert.equal(
    at("CLOSED", {
      issue: { n: 90, state: "CLOSED" },
      pr: { current: null },
      report: "State: closed",
    }),
    "#90 is closed\nState: closed"
  )
  assert.equal(
    at("MISSING_FIELDS", {
      flags: {},
      draft: { problems: ["no --title", "missing --what"] },
    }),
    "no --title; missing --what"
  )
  assert.equal(
    at("MISSING_FIELDS", {
      flags: {},
      requireKind: true,
      issue: { n: 90, body: "" },
    }),
    `#90 has no Type (${TYPE_LIST})`
  )
  assert.match(
    at("MISSING_FIELDS", { flags: {}, desc: "!!!" }),
    /description "!!!" has no usable characters/
  )
  assert.equal(
    at("MISSING_FIELDS", {
      flags: { "--type": "feature" },
      validateType: true,
    }),
    `type must be one of: ${TYPE_LIST}`
  )
  assert.equal(
    at("MISSING_FIELDS", { flags: {}, type: "feature" }),
    `type must be one of: ${TYPE_LIST}`
  )
  const remote = {
    stage: "create",
    name: "feat/90-keep-my-search",
    remote: true,
    held: { state: "idle", agent: "a1" },
  }
  assert.match(
    at("BRANCH_EXISTS", { branch: remote, issue: { n: 90 } }),
    /idle holder a1 already pushed/
  )
  assert.equal(
    evaluate("BRANCH_EXISTS", { branch: remote, issue: { n: 90 } }).fix,
    "scripts/ocv-tools.mjs take 90 --resume"
  )
  const bothTips = {
    stage: "create",
    name: "feat/90-keep-my-search",
    local: true,
    remote: true,
    resume: false,
  }
  assert.equal(
    at("BRANCH_EXISTS", { branch: bothTips, issue: { n: 90 } }),
    "branch feat/90-keep-my-search already exists locally (git worktree list)"
  )
  assert.equal(
    evaluate("BRANCH_EXISTS", { branch: bothTips, issue: { n: 90 } }).fix,
    "Someone is already working on it. Run: scripts/ocv-tools.mjs status <n>"
  )
  assert.equal(
    evaluate("BRANCH_EXISTS", {
      branch: { stage: "create", name: "feat/90-keep", resume: true },
      issue: { n: 90 },
    }).fix,
    "scripts/ocv-tools.mjs take 90"
  )
  assert.match(
    evaluate("DIVERGED", {
      branch: { name: "feat/90-x", relation: "diverged" },
      issue: { n: 90 },
    }).fix,
    /git log --oneline --left-right feat\/90-x\.\.\.origin\/feat\/90-x/
  )
  assert.match(
    at("NOT_A_REPO", { repo: { bare: "bare" } }),
    /expected a non-bare repo \(bare\)/
  )
  assert.match(
    at("UNKNOWN_FLAG", { flag: { name: "--desc", hint: "-d" } }),
    /unknown option: --desc \(use -d\)/
  )
  assert.equal(
    at("BAD_ARGS", { args: { count: 2 } }),
    "expected one target, got 2"
  )
  assert.match(
    at("LOST", { issue: { n: 1 }, claim: { state: "none" }, me: null }),
    /you no longer hold/
  )
  assert.match(
    at("MAIN_CLEAN", { main: { path: "/repo", branch: "" } }),
    /detached HEAD/
  )
  assert.equal(
    at("PORT", {
      port: { recorded: true, worktree: "/wt", env: "1", assigned: "1" },
    }),
    null
  )
  assert.match(
    at("FILE_SIZE", { commits: { oversize: "big.mjs (20001 bytes)" } }),
    /20000-byte/
  )
  assert.equal(
    evaluate("DISK", { disk: { text: "full", cause: "disk" } }).cause,
    "disk"
  )
})

test("decide keeps table order, stops, and refuses a missing fact", () => {
  const facts = {
    issue: {
      n: 90,
      state: "OPEN",
      labels: ["ready-for-human"],
      risk: "high",
      assignees: ["someone"],
      type: "feat",
    },
    claim: { state: "live", agent: "other", idleMinutes: 30 },
    me: "me",
    login: "me",
    flags: {},
    local: {},
    disk: {},
    path: null,
    requireKind: true,
  }
  assert.deepEqual(
    decide("take", facts).refusals.map((row) => row.id),
    ["READY_FOR_HUMAN", "HELD", "ASSIGNED"]
  )
  const closed = decide("take", {
    ...facts,
    issue: { ...facts.issue, state: "CLOSED" },
  })
  assert.deepEqual(
    closed.refusals.map((row) => row.id),
    ["CLOSED"]
  )
  assert.equal(closed.ok, false)
  assert.throws(
    () => decide("take", {}),
    /take did not gather issue for CLOSED/
  )
  assert.throws(
    () => decide("take", { issue: { n: 1, state: "OPEN", labels: [] } }),
    /take did not gather claim for HELD/
  )
  for (const kind of [
    "issue",
    "claim",
    "me",
    "login",
    "flags",
    "local",
    "disk",
    "path",
  ])
    assert.ok(needsOf("take").includes(kind), kind)
  assert.ok(needsOf("take-branch").includes("branch"))
  assert.equal(
    decide("save", { here: { ok: false } }).refusals[0].id,
    "NOT_A_TASK"
  )
  assert.equal(decide("save", { here: { ok: false } }).refusals.length, 1)
})

test("cli refusal text matches the table", () => {
  const ctx = ctxFor(fakePorts())
  const names = COMMANDS.map((row) => row.name).join(", ")
  const pairs = [
    [["nope"], "UNKNOWN_COMMAND", { command: { name: "nope", names } }],
    [
      ["take", "90", "--no-asign"],
      "UNKNOWN_FLAG",
      { flag: { name: "--no-asign" } },
    ],
    [
      ["take", "90", "--desc", "words"],
      "UNKNOWN_FLAG",
      { flag: { name: "--desc", hint: "-d" } },
    ],
    [["take", "90", "-d"], "MISSING_FIELDS", { flags: {}, missingValue: "-d" }],
    [
      ["take", "90", "--type", "feature"],
      "MISSING_FIELDS",
      { flags: { "--type": "feature" }, validateType: true },
    ],
    [["take", "0"], "BAD_ISSUE", { token: { text: "0" } }],
    [["take", "90", "A title here"], "BAD_ARGS", { args: { both: true } }],
    [["take", "90", "91"], "BAD_ARGS", { args: { count: 2 } }],
  ]
  for (const [argv, id, facts] of pairs) {
    const hit = evaluate(id, facts)
    const result = runCli(argv, ctx)
    assert.ok(
      result.text.includes(`REFUSED ${id}: ${hit.message}`),
      `${argv.join(" ")} -> ${result.text}`
    )
  }
})
