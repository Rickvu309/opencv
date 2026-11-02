// The delivery rows (finish, merge, queue) read domain facts, not a verdict
// the job made itself. Each row has a failing and a passing fact here.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  ACCEPTED_EVIDENCE,
  REFUSED_EVIDENCE,
} from "./pr-body-fixtures/evidence-cases.mjs"
import { decide, evaluate, jobRows } from "./index.mjs"

const BODY =
  "## Summary\n\nA change.\n\n## Evidence\n\n`node --test scripts/x.test.mjs`: 4 pass.\n\n## Merge Danger\n\n**Door:** two-way\n**Blast Radius:** jobs\n"
const pull = {
  n: 7,
  isDraft: false,
  labels: [],
  branch: "feat/7-keep-search",
  state: "OPEN",
  head: "h1",
  author: "Owner",
}
const ci = { status: "completed", conclusion: "success", head: "h1" }
const queue = (over) => ({
  queue: { n: 7, notes: [], limitMinutes: 45, ...over },
  snapshot: { head: "h1" },
})

const CASES = {
  STALE_CHECK: [
    { snapshot: { before: { tree: "a" }, after: { tree: "b" } } },
    { snapshot: { before: { tree: "a" }, after: { tree: "a" } } },
    "The saved work changed during push. Finish again.",
  ],
  BAD_BODY: [
    {
      body: { file: "/b.md", text: "## Summary\nOnly this" },
      pull: { title: "feat: add a thing (#7)" },
    },
    {
      body: { file: "/b.md", text: BODY },
      pull: { title: "feat: add a thing (#7)" },
    },
    "The PR body needs ## Evidence.",
  ],
  BAD_TITLE: [
    { pull: { title: "Add a thing" } },
    { pull: { title: "feat: add a thing (#7)" } },
    "The PR title is invalid.",
  ],
  NO_COMMITS: [
    { commits: { count: 0 } },
    { commits: { count: 2 } },
    "No commits beyond origin/main.",
  ],
  DRAFT: [{ pull: { ...pull, isDraft: true } }, { pull }, "PR #7 is a draft."],
  NEEDS_HUMAN_REVIEW: [
    { pull: { ...pull, labels: ["needs-human-review"] } },
    { pull },
    "PR #7 needs human review; an agent never merges it.",
  ],
  BAD_BRANCH: [
    { pull: { ...pull, branch: "my-branch" } },
    { pull },
    "PR #7 has no linked issue in its branch name.",
  ],
  CLOSED_PR: [
    { pull: { ...pull, state: "CLOSED" } },
    { pull: { ...pull, state: "MERGED" } },
    "PR #7 is CLOSED.",
  ],
  CI_REQUIRED: [
    { pull, ci: { ...ci, conclusion: "failure" } },
    { pull, ci },
    "The ci check on head h1 is failure, not success.",
  ],
  LEFT_QUEUE: [
    queue({ kind: "LEFT_QUEUE", reason: "CI_FAILURE", at: "noon" }),
    queue({ kind: "QUEUE_TIMEOUT" }),
    "PR #7 left the merge queue at noon, reason CI_FAILURE.",
  ],
  QUEUE_TIMEOUT: [
    queue({ kind: "QUEUE_TIMEOUT", queueState: "QUEUED" }),
    queue({ kind: "LEFT_QUEUE" }),
    "PR #7 is still not merged after 45 minutes (QUEUED).",
  ],
  HEAD_MOVED: [
    queue({ kind: "HEAD_MOVED", from: "h1", to: "h2" }),
    queue({ kind: "LEFT_QUEUE" }),
    "PR #7 head moved from h1 to h2.",
  ],
  CI_FAILED: [
    queue({
      kind: "CI_FAILED",
      conclusion: "failure",
      run: { html_url: "https://run" },
      notes: ["a.mjs:3 broke", "b.mjs:1 broke"],
    }),
    queue({ kind: "LEFT_QUEUE" }),
    "The ci check on h1 is failure. Failing run: https://run.\na.mjs:3 broke\nb.mjs:1 broke",
  ],
}

test("every delivery row has a failing and a passing fact", () => {
  assert.deepEqual(Object.keys(CASES).sort(), jobRows.map((r) => r.id).sort())
  for (const row of jobRows) {
    const [bad, good, message] = CASES[row.id]
    assert.equal(row.check(bad), message, row.id)
    assert.equal(row.check(good), null, row.id)
    assert.ok(evaluate(row.id, bad).fix.length > 0, row.id)
    assert.ok(row.fix({}).length > 0, row.id)
    assert.ok(!row.at.includes("pr"), `${row.id} must not run in policy`)
  }
})

test("a body needs content under each section, and a readable file", () => {
  const body = (text, extra) => ({ body: { file: "/b.md", text, ...extra } })
  const check = (facts) => jobRows.find((r) => r.id === "BAD_BODY").check(facts)
  assert.equal(
    check(body("## Summary\n\n## Evidence\nx\n## Merge Danger\nx")),
    "The PR body needs ## Summary."
  )
  assert.equal(
    check({ body: { file: null, text: "" } }),
    "Pass --body-file <file>."
  )
  assert.match(check(body("", { unreadable: true })), /cannot be read/)
  assert.match(
    check(body(BODY.replace("**Door:** two-way", "**Door:** <one-way>"))),
    /Door, Blast Radius/
  )
})

const fixture = (name) =>
  readFileSync(new URL(`pr-body-fixtures/${name}`, import.meta.url), "utf8")
const badBody = (text, title = "feat: add a thing (#7)") =>
  jobRows
    .find((r) => r.id === "BAD_BODY")
    .check({ body: { file: "/b.md", text }, pull: { title } })

const withEvidence = (evidence) =>
  BODY.replace("`node --test scripts/x.test.mjs`: 4 pass.", evidence)

test("evidence needs a command with its result, or a picture or run link", () => {
  assert.equal(badBody(BODY), null)
  for (const evidence of REFUSED_EVIDENCE)
    assert.match(
      badBody(withEvidence(evidence)),
      /^Evidence needs a command with its result/,
      evidence
    )
})

test("honest evidence forms are accepted", () => {
  for (const evidence of ACCEPTED_EVIDENCE)
    assert.equal(badBody(withEvidence(evidence)), null, evidence)
})

test("the body names no path under the author's own machine", () => {
  const local = BODY.replace("4 pass.", "4 pass, log at /home/quan/x.log")
  assert.match(badBody(local), /path on your machine/)
  assert.match(badBody(BODY.replace("4 pass.", "4 pass ~/tmp/out")), /path on/)
  assert.match(badBody("/home/quan/tmp/pr-body.md"), /needs ## Summary/)
})

test("a fix or hotfix PR names who caught the bug and what introduced it", () => {
  const FIX = "fix: keep the photo (#7)"
  assert.match(badBody(BODY, FIX), /Caught by:/)
  assert.equal(badBody(BODY, "chore: tidy (#7)"), null)
  const caught = `${BODY}\nCaught by: ci\n`
  assert.match(badBody(caught, FIX), /Introduced by:/)
  assert.match(
    badBody(`${caught}Introduced by: someone\n`, FIX),
    /Introduced by:/
  )
  assert.match(
    badBody(`${BODY}\nCaught by: nobody\nIntroduced by: #9\n`, FIX),
    /Caught by:/
  )
  for (const introduced of ["#911", "unknown", "d29f8b87", "d29f8b87d29f8b87"])
    assert.equal(
      badBody(
        `${caught}Introduced by: ${introduced}\n`,
        "hotfix: stop it (#7)"
      ),
      null,
      introduced
    )
})

test("saved PR bodies: 487 and 915 are refused, a compliant fix passes", () => {
  const FIX = "fix: change (#7)"
  assert.match(badBody(fixture("pr-487.txt"), FIX), /needs ## Summary/)
  assert.match(badBody(fixture("pr-915.txt"), FIX), /Caught by:/)
  assert.equal(badBody(fixture("compliant-fix.txt"), FIX), null)
})

test("merge holds the owner, and the draft passes the pr moment", () => {
  const facts = { pull: { ...pull, isDraft: true }, me: "owner", ci }
  assert.deepEqual(
    decide("merge", facts).refusals.map((r) => r.id),
    ["DRAFT"]
  )
  const other = decide("merge", { ...facts, pull, me: "someone" })
  assert.equal(other.refusals[0].id, "NOT_OWNER")
  assert.equal(other.refusals[0].message, "PR #7 is by Owner, not someone.")
  assert.equal(decide("merge", { ...facts, pull, me: "OWNER" }).ok, true)
  // A merged PR has no ci to check.
  const merged = { pull: { ...pull, state: "MERGED" }, me: "owner", ci: null }
  assert.equal(decide("merge", merged).ok, true)
})

test("merge refuses a PR whose issue carries needs-human-review", () => {
  const withIssue = (labels) => ({
    pull,
    issue: { n: 7, labels },
    me: "Owner",
    ci,
  })
  assert.equal(decide("merge", withIssue([])).ok, true)
  const held = decide("merge", withIssue(["needs-human-review"]))
  assert.deepEqual(
    held.refusals.map((r) => r.id),
    ["NEEDS_HUMAN_REVIEW"]
  )
})

test("finish refuses a body with no Evidence before it pushes", () => {
  const verdict = decide("finish", {
    here: { ok: true },
    body: { file: "/b.md", text: "## Summary\nOnly this" },
    pull: { title: "feat: add a thing (#7)", issue: 7, issueState: "OPEN" },
    commits: { count: 1, trailers: "", oversize: "" },
    issue: { n: 7, state: "OPEN", labels: [] },
    disk: {},
    work: { path: "/wt", dirty: "", finish: true },
    main: { path: "/m", branch: "main", dirty: "" },
    port: null,
    env: {},
    diff: { files: "", labels: [], ciYmlAtHead: true, deleted: {} },
  })
  assert.equal(verdict.refusals[0].id, "BAD_BODY")
  assert.equal(verdict.refusals[0].message, "The PR body needs ## Evidence.")
})
