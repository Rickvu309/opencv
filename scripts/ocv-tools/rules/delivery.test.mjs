import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  ACCEPTED_EVIDENCE,
  REFUSED_EVIDENCE,
} from "./pr-body-fixtures/evidence-cases.mjs"
import { decide, evaluate, jobRows } from "./index.mjs"

const BODY =
  "**Now:** A change.\n**Proof:** `node --test scripts/x.test.mjs`: 4 pass.\n"
const NEEDS_LEAD =
  "Start the PR body with **Now:** <text> followed by **Proof:** <text>, or a bold answer followed by a <details> block."
const NO_MIGRATIONS = { files: [], allowed: [] }
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

const CASES = {
  STALE_CHECK: [
    { snapshot: { before: { tree: "a" }, after: { tree: "b" } } },
    { snapshot: { before: { tree: "a" }, after: { tree: "a" } } },
    "The saved work changed during push. Finish again.",
  ],
  BAD_BODY: [
    {
      body: { file: "/b.md", text: "**Now:** Only this" },
      migrations: NO_MIGRATIONS,
      diff: { files: [] },
      pull: { title: "feat: add a thing (#7)" },
    },
    {
      body: { file: "/b.md", text: BODY },
      migrations: NO_MIGRATIONS,
      diff: { files: [] },
      pull: { title: "feat: add a thing (#7)" },
    },
    NEEDS_LEAD,
  ],
  NO_BEFORE_AFTER: [
    {
      body: { text: BODY },
      diff: { files: ["packages/ui/src/components/button.tsx"] },
    },
    {
      body: { text: BODY },
      diff: { files: ["packages/ui/src/components/button.test.tsx"] },
    },
    "This PR edits 1 screen file(s), including packages/ui/src/components/button.tsx. Add a ## Before / after section.",
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
  BILLING_BLOCKED: [
    { pull, billing: { runId: 5, message: "payments failed" } },
    { pull, billing: null },
    "CI cannot run on PR #7: GitHub did not start run 5 because the account's payments failed or its Actions spending limit is used up. A rerun or a new merge will not help.",
  ],
}

test("every delivery row reads domain facts, with a failing and a passing fact", () => {
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

test("a body needs text on each lead line and a readable file", () => {
  const body = (text, extra) => ({ body: { file: "/b.md", text, ...extra } })
  const check = (facts) => jobRows.find((r) => r.id === "BAD_BODY").check(facts)
  assert.equal(
    check(body("**Now:**\n**Proof:** `node x.mjs`: exit 0")),
    NEEDS_LEAD
  )
  assert.equal(
    check({
      ...body("**Now:** A fix.\n**Proof:** It works, see /home/me/log."),
      pull: { title: "fix: a thing (#7)" },
    }),
    "5 problems. (1) The PR body names a path on your machine (/home/ or ~/tmp). Show the command and its result, or link a picture. (2) Proof needs a command with its result on the same line or in the output block under it (exit 0, N passed, 0 mismatches), an image, or a link to a CI run. (3) Start with a bold answer and a <details> block holding the question and two to four lettered reasons. Write it with node .agents/skills/show-opencv/bin/logic.mjs tree.json. (4) A fix needs a line: Caught by: user|ci|review|verify-skill|test|agent-self (5) A fix needs a line: Introduced by: <sha>|#<pr>|unknown"
  )
  assert.equal(
    check({ body: { file: null, text: "" } }),
    "Pass --body-file <file>."
  )
  assert.match(check(body("", { unreadable: true })), /cannot be read/)
  assert.match(
    check(body(`${BODY}\n<screenshot>`)),
    /Fill in all template placeholders/
  )
})

const fixture = (name) =>
  readFileSync(new URL(`pr-body-fixtures/${name}`, import.meta.url), "utf8")
const badBody = (
  text,
  title = "feat: add a thing (#7)",
  migrations = NO_MIGRATIONS,
  files = []
) =>
  jobRows
    .find((r) => r.id === "BAD_BODY")
    .check({
      body: { file: "/b.md", text },
      pull: { title },
      migrations,
      diff: { files },
    })

const withEvidence = (evidence) =>
  BODY.replace(
    "`node --test scripts/x.test.mjs`: 4 pass.",
    /^(?:```|~~~)/.test(evidence) ? `Command output\n\n${evidence}` : evidence
  )

test("evidence needs a command with its result, or a picture or run link", () => {
  assert.equal(badBody(BODY), null)
  for (const evidence of REFUSED_EVIDENCE)
    assert.match(
      badBody(withEvidence(evidence)),
      /^Proof needs a command with its result/,
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
  assert.match(badBody("/home/quan/tmp/pr-body.md"), /Start the PR body/)
})

test("a fix or hotfix PR names who caught the bug and what introduced it", () => {
  const FIX = "fix: keep the photo (#7)"
  assert.match(badBody(BODY, FIX), /Caught by:/)
  assert.equal(badBody(BODY, "chore: tidy (#7)"), null)
  const tree = fixture("tree.txt")
  const caught = `${tree}\nCaught by: ci\n`
  assert.match(badBody(caught, FIX), /Introduced by:/)
  assert.match(
    badBody(`${caught}Introduced by: someone\n`, FIX),
    /Introduced by:/
  )
  assert.match(
    badBody(`${tree}\nCaught by: nobody\nIntroduced by: #9\n`, FIX),
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

test("fix and screen bodies need a proof tree next to the bold answer", () => {
  const title = "fix: preview Paper cards (#7)"
  const provenance = "\nCaught by: review\nIntroduced by: #911\n"
  const command =
    /node \.agents\/skills\/show-opencv\/bin\/logic\.mjs tree\.json/
  const tree = fixture("tree.txt")

  assert.match(badBody(BODY + provenance, title), command)
  assert.equal(badBody(tree + provenance, title), null)
  assert.equal(badBody(BODY, "feat: Add a check (#7)"), null)

  const screen = ["apps/web/src/features/paper/paper-library-sections.tsx"]
  const screenTitle = "feat: preview Paper cards (#7)"
  assert.match(badBody(BODY, screenTitle, NO_MIGRATIONS, screen), command)
  assert.equal(badBody(tree, screenTitle, NO_MIGRATIONS, screen), null)
  assert.equal(
    badBody(BODY, screenTitle, NO_MIGRATIONS, [
      "packages/ui/src/button.test.tsx",
    ]),
    null
  )

  for (const malformed of [
    tree.replace("sheet?*", "sheet.*"),
    tree.replace("- **B.**", "  - **B.**"),
    tree.replace("- **B.**", "- **C.**"),
    tree.replace(
      "</details>",
      "- **C.** Third reason\n- **D.** Fourth reason\n- **E.** Fifth reason\n</details>"
    ),
    tree
      .replace(
        "<summary>Detail</summary>",
        "<summary>Detail</summary>\n\n~~~markdown"
      )
      .replace("</details>", "~~~\n</details>"),
    tree
      .replace(
        "<summary>Detail</summary>",
        "<summary>Detail</summary>\n\n<details>"
      )
      .replace("</details>", "</details>\n</details>"),
    tree.replace("<details>", "A public paragraph.\n\n<details>"),
  ])
    assert.match(badBody(malformed + provenance, title), command)
})

test("saved PR bodies: 487 and 915 are refused, a compliant fix passes", () => {
  const FIX = "fix: change (#7)"
  assert.match(badBody(fixture("pr-487.txt"), FIX), /Start the PR body/)
  assert.match(badBody(fixture("pr-915.txt"), FIX), /Caught by:/)
  assert.equal(badBody(fixture("compliant-fix.txt"), FIX), null)
})

test("the original PR 2140 body is refused and the rewrite passes", () => {
  assert.match(badBody(fixture("pr-2140.txt")), /\*\*Now:\*\*.*\*\*Proof:\*\*/)
  assert.equal(badBody(fixture("pr-2140-rewrite.txt")), null)
  assert.match(
    badBody(
      `${withEvidence("Checked.")}\n<details>\n` +
        "`node --test`: exit 0.\n</details>"
    ),
    /Proof needs a command/
  )
})

test("a bold answer can lead a body with evidence inside a details block", () => {
  assert.equal(badBody(fixture("tree.txt")), null)
  assert.match(badBody("**The checks pass.**"), /Start the PR body/)
  assert.match(
    badBody("**The checks pass.**\n\n<details>\nClaim only.\n</details>"),
    /Proof needs a command/
  )
  assert.match(
    badBody("**The checks pass.**\n\n```html\n<details>\n</details>\n```"),
    /Start the PR body/
  )
  assert.match(
    badBody(`<details>\nContent\n</details>\n\n${BODY}`),
    /Start the PR body/
  )
})

test("the lead counts fenced code lines and excludes folded detail", () => {
  const folded = `<details><summary>Detail</summary>\n\n${"Hidden.\n".repeat(26)}\n</details>`
  const visible = (count) =>
    `${BODY}\n\`\`\`text\n<details>\n${"Visible.\n".repeat(count)}</details>\n\`\`\`\n\n${folded}`
  assert.equal(badBody(visible(19)), null)
  assert.match(
    badBody(visible(20)),
    /at most 25 non-empty lines.*Fenced code lines count/
  )
  assert.match(badBody(fixture("long-lead.txt")), /at most 25 non-empty lines/)
})

test("a migration needs a visible Risk line even when it only adds", () => {
  const migrations = { files: [{ tag: "new_table", changes: [] }], allowed: [] }
  const check = (body) => badBody(body, undefined, migrations)
  assert.match(check(BODY), /migration needs a \*\*Risk:\*\*/)
  assert.match(
    check(`${BODY}\n<details>\n**Risk:** Adds a table.\n</details>`),
    /migration needs/
  )
  assert.match(
    check(`${BODY}\n\`\`\`text\n**Risk:** Adds a table.\n\`\`\``),
    /migration needs/
  )
  assert.equal(check(`${BODY}\n**Risk:** Adds a table.`), null)
})

test("merge holds the owner, and the draft passes the pr moment", () => {
  const migrations = { files: [], allowed: [] }
  const facts = {
    pull: { ...pull, isDraft: true },
    me: "owner",
    ci,
    migrations,
  }
  assert.deepEqual(
    decide("merge", facts).refusals.map((r) => r.id),
    ["DRAFT"]
  )
  const other = decide("merge", { ...facts, pull, me: "someone" })
  assert.equal(other.refusals[0].id, "NOT_OWNER")
  assert.equal(other.refusals[0].message, "PR #7 is by Owner, not someone.")
  assert.equal(decide("merge", { ...facts, pull, me: "OWNER" }).ok, true)
  const mergedHasNoCiToCheck = {
    pull: { ...pull, state: "MERGED" },
    me: "owner",
    ci: null,
    migrations,
  }
  assert.equal(decide("merge", mergedHasNoCiToCheck).ok, true)
})

test("legacy review labels on the issue or PR do not block a green merge", () => {
  for (const labels of [[], ["needs-human-review"]]) {
    const facts = {
      pull: { ...pull, labels },
      issue: { n: 7, labels },
      me: "Owner",
      ci,
      migrations: { files: [], allowed: [] },
    }
    assert.equal(decide("merge", facts).ok, true)
    assert.equal(
      decide("merge", { ...facts, ci: { ...ci, conclusion: "failure" } }).ok,
      false
    )
  }
})

test("finish refuses a body with no Proof before it pushes", () => {
  const verdict = decide("finish", {
    here: { ok: true },
    body: { file: "/b.md", text: "**Now:** Only this" },
    migrations: NO_MIGRATIONS,
    pull: { title: "feat: add a thing (#7)", issue: 7, issueState: "OPEN" },
    commits: { count: 1, trailers: "", oversize: "" },
    issue: { n: 7, state: "OPEN", labels: [] },
    disk: {},
    work: { path: "/wt", dirty: "", finish: true },
    main: { path: "/m", branch: "main", dirty: "" },
    port: null,
    env: {},
    diff: { files: "", labels: [], ciYmlAtHead: true, deleted: {} },
    protected: { weakened: [], retired: [], retirements: [] },
  })
  assert.equal(verdict.refusals[0].id, "BAD_BODY")
  assert.equal(verdict.refusals[0].message, NEEDS_LEAD)
})
