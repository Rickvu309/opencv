import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { runCli } from "./cli.mjs"
import { ctxFor, fakePorts } from "./ports/fake.mjs"
import { COMMANDS } from "./report.mjs"
import { decide, evaluate, needsOf } from "./rules/decide.mjs"
import { RULES_DOC, renderRulesDoc, rulesDocMatches } from "./rules/doc.mjs"
import { RULES } from "./rules/table.mjs"

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
    "NEEDS_APPROVAL",
    { issue: { n: 90, risk: "high", approved: false } },
    { issue: { n: 90, risk: "high", approved: true } },
    "#90 is risk:high and the owner has not commented /approve after its last edit"
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
    { issue: { n: 90 }, local: { worktree: "/wt/90", branch: "feat/90-keep" } },
    { issue: { n: 90 }, local: {} },
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
    "/wt/90 has unsaved work:\n M x.txt"
  )
  check(
    "NOT_MERGED",
    { work: { branch: "feat/90-keep", merged: false } },
    { work: { branch: "feat/90-keep", merged: true } },
    "feat/90-keep has no merged pull request"
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
    "workflows other than ci.yml are not added without an issue: .github/workflows/extra.yml"
  )
  check(
    "CI_WORKFLOW_KEPT",
    { diff: { files: ".github/workflows/ci.yml", ciYmlAtHead: false } },
    { diff: { files: ".github/workflows/ci.yml", ciYmlAtHead: true } },
    "the change deletes .github/workflows/ci.yml: the file may change, never vanish (the required ci check runs from it)"
  )
  check(
    "RISK_HIGH_FOR_CI",
    { diff: { files: ["scripts/check.sh"], labels: ["risk:low"] } },
    { diff: { files: ["scripts/check.sh"], labels: ["risk:high"] } },
    "the change touches ci.yml, check.sh or the main ruleset, which attest the ci check itself, and the issue is not labeled risk:high (owner approval, slice 5 of epic #582)"
  )
  check(
    "SKIP_DECLARED",
    { env: { SKIP_CHECKS: "1" } },
    { env: { SKIP_CHECKS: "1", SKIP_CHECKS_DECLARED_BY: "Ada" } },
    "SKIP_CHECKS=1 is for a production emergency a human declared; no human is named"
  )
  check(
    "SKIP_SAID",
    { pull: { stamp: "skip", sha: "abcdef123", pr: 7, body: "no emergency" } },
    {
      pull: {
        stamp: "skip",
        sha: "abcdef123",
        pr: 7,
        body: "emergency declared by Ada",
      },
    },
    'head abcdef123 was pushed with SKIP_CHECKS=1 (only for an emergency a human declared) and PR #7 does not say "emergency declared by <name>"'
  )
  check(
    "PUSHED_THROUGH_HOOK",
    { commits: { stampDir: true, stamp: null, sha: "abcdef1234" } },
    { commits: { stampDir: false, stamp: null, sha: "abcdef1234" } },
    "commit abcdef123 has no pre-push stamp: it was pushed without the pre-push hook (the hook-skip flag, or a branch cut before the stamping hook landed, whose worktree still runs the old .githooks/pre-push)"
  )
  check(
    "COMMITS_HOOKED",
    { commits: { trailers: "abc1234 " } },
    { commits: {} },
    "commit(s) abc1234 carry an attribution trailer, which the commit-msg hook refuses: they were made without that hook (the hook-skip flag, a cherry-pick or a rebase)"
  )
  check(
    "NOT_HIGH_RISK",
    { issue: { n: 90, risk: "normal" } },
    { issue: { n: 90, risk: "high" } },
    "#90 is normal risk, so no approval is needed"
  )
  check(
    "MISSING_FILE",
    { picture: { path: "a.png", exists: false } },
    { picture: { path: "a.png", exists: true } },
    "a.png does not exist"
  )
  check(
    "BAD_PICTURE",
    { picture: { path: "a.txt", bytesChecked: false } },
    { picture: { path: "a.png", type: "png" } },
    "a.txt is not a png, jpg, gif or webp (checked the file bytes)"
  )
  check(
    "TOO_BIG",
    { picture: { path: "a.png", bytes: 10 * 1024 * 1024 + 1 } },
    { picture: { path: "a.png", bytes: 100 } },
    "a.png is over 10 MB"
  )
  check(
    "TOO_MANY",
    { shot: { count: 21 } },
    { shot: { count: 20 } },
    "shot takes at most 20 pictures per run (21 given)"
  )
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
    at("MISSING_FIELDS", { flags: {}, draft: { missingTitle: true } }),
    "no --title"
  )
  assert.equal(
    at("MISSING_FIELDS", { flags: {}, draft: { badTitle: true } }),
    `the title must start with one of ${TYPE_LIST} and a colon, for example "fix: ..."`
  )
  assert.equal(
    at("MISSING_FIELDS", { flags: {}, draft: { bodyError: "missing --what" } }),
    "missing --what"
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
  assert.equal(at("SKIP_SAID", { pull: { stamp: "ok", body: "" } }), null)
  assert.match(
    at("COMMITS_HOOKED", { commits: { oversize: "big.mjs (20001 bytes)" } }),
    /20000-byte/
  )
  assert.equal(
    at("PUSHED_THROUGH_HOOK", { commits: { stampDir: true, stamp: "ok" } }),
    null
  )
  assert.equal(
    evaluate("DISK", { disk: { text: "full", cause: "disk" } }).cause,
    "disk"
  )
})

test("decide keeps table order, stops, and refuses a missing fact", () => {
  const facts = {
    history: { kind: "complete" },
    issue: {
      n: 90,
      state: "OPEN",
      labels: ["ready-for-human"],
      risk: "high",
      approved: false,
      assignees: ["someone"],
      type: "feat",
    },
    claim: { state: "live", agent: "other", idleMinutes: 30 },
    me: "me",
    login: "me",
    flags: {},
    local: {},
    disk: {},
    branch: { stage: "later" },
    repo: { ok: true },
    requireKind: true,
  }
  assert.deepEqual(
    decide("take", facts).refusals.map((row) => row.id),
    ["READY_FOR_HUMAN", "HELD", "NEEDS_APPROVAL", "ASSIGNED"]
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
    /take did not gather issue for NOT_AN_ISSUE/
  )
  assert.throws(
    () => decide("take", { issue: { n: 1, state: "OPEN", labels: [] } }),
    /take did not gather history for UNKNOWN/
  )
  for (const kind of [
    "issue",
    "history",
    "claim",
    "me",
    "login",
    "flags",
    "local",
    "disk",
    "branch",
    "repo",
  ])
    assert.ok(needsOf("take").includes(kind), kind)
  assert.equal(
    decide("save", { here: { ok: false } }).refusals[0].id,
    "NOT_A_TASK"
  )
  assert.equal(decide("save", { here: { ok: false } }).refusals.length, 1)
})

test("bash rule functions have a table row", () => {
  const text = readFileSync(
    fileURLToPath(new URL("../lib/rules.sh", import.meta.url)),
    "utf8"
  )
  const skip = new Set(["fail", "cd", "wt_of", "stamp_dir"])
  const names = [...text.matchAll(/^rule_([a-z0-9_]+)\(\)/gm)].map((m) => m[1])
  assert.ok(names.includes("main_clean"))
  for (const name of names) {
    if (skip.has(name)) continue
    assert.ok(
      RULES.some((row) => row.impl === `bash:rule_${name}`),
      name
    )
  }
})

test("the rules guide is generated from the table", () => {
  const md = renderRulesDoc()
  assert.match(md, /\| rule \| what makes it fail \| fix \| jobs \|/)
  for (const row of RULES) assert.ok(md.includes(row.id), row.id)
  assert.match(md, /OTHER_WORKTREE \(2\).*Nothing/)
  assert.equal(rulesDocMatches(readFileSync(RULES_DOC, "utf8")), true)
})

test("rules --check fails on a stale block and --write repairs the fake", () => {
  const ports = fakePorts()
  const ctx = ctxFor(ports)
  const fresh = readFileSync(RULES_DOC, "utf8")
  assert.equal(runCli(["rules", "--check"], ctx).code, 0)
  ports.fs.write(
    RULES_DOC,
    fresh.replaceAll("NOT_AN_ISSUE", "NOT_AN_ISSUE_STALE")
  )
  const stale = runCli(["rules", "--check"], ctx)
  assert.equal(stale.code, 1)
  assert.match(stale.text, /Fix: Run: scripts\/ocv-tools\.mjs rules --write/)
  assert.equal(runCli(["rules", "--write"], ctx).code, 0)
  assert.equal(runCli(["rules", "--check"], ctx).code, 0)
  const listed = runCli(["rules", "--list"], ctx)
  assert.equal(listed.code, 0)
  assert.match(listed.text, /NOT_AN_ISSUE:/)
  assert.match(listed.text, /\nNext: /)
})

test("doctor lists every rule from the table", () => {
  const { text } = runCli(["doctor"], ctxFor(fakePorts()))
  assert.match(text, /Rules:/)
  for (const row of RULES) assert.match(text, new RegExp(`  ${row.id}:`))
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
