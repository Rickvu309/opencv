import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { fixture } from "./fixture.mjs"

const MIGRATIONS = new URL("./migration-fixtures/", import.meta.url)
const sqlOf = (name) => readFileSync(new URL(`${name}.sql`, MIGRATIONS), "utf8")
const RED = { name: "production-red" }
const CI_FILE = ".github/workflows/ci.yml"

function migrationWorld(tag, fixtureName, over = {}) {
  const file = `apps/api/drizzle/${tag}.sql`
  return fixture({
    changed: ["apps/api/src/paper/store.ts", file],
    intercept(cmd, args) {
      if (cmd === "git" && args[0] === "show" && args[1].endsWith(file))
        return { ok: true, out: sqlOf(fixtureName), err: "" }
      return null
    },
    ...over,
  })
}

const labelled = (f) =>
  f
    .effects("gh", "pr edit")
    .map((e) => e.args[e.args.indexOf("--add-label") + 1])

test("policy refuses an owner PR without owner-approved and passes it with the label", () => {
  const bare = fixture({ changed: [CI_FILE], issueLabels: ["risk:high"] })
  const refused = bare.call("policy", "91")
  assert.equal(refused.code, 2, refused.text)
  assert.match(
    refused.text,
    /OWNER_YES: this pull request is owner class \(\.github\/workflows\/ci\.yml attests the ci check\)/
  )
  const yes = fixture({ changed: [CI_FILE], issueLabels: ["risk:high"] })
  yes.s.pull.labels = [{ name: "owner-approved" }]
  const passed = yes.call("policy", "91")
  assert.equal(passed.code, 0, passed.text)
})

test("policy holds a migration off the only-adds list until its allow label; an only-adds migration needs none", () => {
  const tag = "0024_word_rename_retained"
  const bare = migrationWorld(tag, "pr-1407-0024_word_rename_retained")
  const refused = bare.call("policy", "91")
  assert.equal(refused.code, 2)
  assert.match(
    refused.text,
    /MIGRATION_CHANGES: the merge runs 0024_word_rename_retained/
  )
  const allowed = migrationWorld(tag, "pr-1407-0024_word_rename_retained")
  allowed.s.pull.labels = [
    { name: `allow-migration:${tag}` },
    { name: "owner-approved" },
  ]
  const passed = allowed.call("policy", "91")
  assert.equal(passed.code, 0, passed.text)
  const adds = migrationWorld(
    "0023_package_trash",
    "pr-1407-0023_package_trash"
  )
  assert.equal(adds.call("policy", "91").code, 0)
})

test("an open production-red issue holds every PR but the revert; a closed one does not count", () => {
  const open = [{ number: 1600, state: "OPEN", labels: [RED] }]
  const plain = fixture({ redIssues: open })
  const refused = plain.call("policy", "91")
  assert.equal(refused.code, 2)
  assert.match(refused.text, /QUEUE_CLOSED: production is red \(#1600 open\)/)
  const revert = fixture({ redIssues: open })
  revert.s.pull.labels = [{ name: "production-red-revert" }]
  assert.equal(revert.call("policy", "91").code, 0)
  const closed = fixture({
    redIssues: [{ number: 1600, state: "CLOSED", labels: [RED] }],
  })
  assert.equal(closed.call("policy", "91").code, 0)
  const merging = fixture({ redIssues: open })
  const held = merging.call("merge", "91")
  assert.equal(held.code, 2)
  assert.match(held.text, /QUEUE_CLOSED/)
  assert.equal(merging.effects("gh", "pr merge").length, 0)
})

test("merge on an owner PR adds owner-approved, and with --allow-migration adds the allow label", () => {
  const owner = fixture({ changed: [CI_FILE], issueLabels: ["risk:high"] })
  const r = owner.call("merge", "91")
  assert.equal(r.code, 0, r.text)
  assert.deepEqual(labelled(owner), ["owner-approved"])
  assert.equal(owner.effects("gh", "pr merge").length, 1)
  const tag = "0024_word_rename_retained"
  const migration = migrationWorld(tag, "pr-1407-0024_word_rename_retained")
  const m = migration.call("merge", "91", "--allow-migration", tag)
  assert.equal(m.code, 0, m.text)
  assert.deepEqual(labelled(migration), [
    `allow-migration:${tag},owner-approved`,
  ])
  assert.equal(
    migration.effects("gh", "label create")[0].args[2],
    `allow-migration:${tag}`
  )
  const ordinary = fixture()
  assert.equal(ordinary.call("merge", "91").code, 0)
  assert.equal(ordinary.effects("gh", "pr edit").length, 0)
})

test("labels added to a PR whose ci failed rerun its failed jobs and turn on auto-merge", () => {
  const f = fixture({
    changed: [CI_FILE],
    issueLabels: ["risk:high"],
    autoOn: true,
    checks: [
      {
        id: 2,
        name: "ci",
        status: "completed",
        conclusion: "failure",
        head_sha: "head-1",
      },
    ],
    runs: [{ id: 77, event: "pull_request", path: CI_FILE }],
  })
  const r = f.call("merge", "91")
  assert.equal(r.code, 0, r.text)
  assert.deepEqual(f.effects("gh", "run rerun")[0].args, [
    "run",
    "rerun",
    "77",
    "--failed",
  ])
  assert.match(r.text, /Added owner-approved to PR #91/)
  assert.match(r.text, /Auto-merge is on/)
  assert.ok(f.effects("gh", "pr merge")[0].args.includes("--auto"))
})

test("merge --wait on an auto-merge PR only waits, then closes the issue", () => {
  const f = fixture({ queue: true })
  f.s.pull.autoMergeRequest = { mergeMethod: "SQUASH" }
  f.s.onPause = (total, s) => {
    s.pull.state = "MERGED"
    s.pull.mergeCommit = { oid: "merged-auto" }
  }
  const r = f.call("merge", "91", "--wait")
  assert.match(r.text, /PR #91 is on auto-merge/)
  assert.match(r.text, /Merged PR #91 as merged-auto/)
  assert.equal(f.effects("gh", "pr merge").length, 0)
  assert.equal(f.effects("git", "merge-tree").length, 0)
  assert.equal(f.effects("gh", "issue close").length, 1)
  const quick = fixture({ queue: true })
  quick.s.pull.autoMergeRequest = { mergeMethod: "SQUASH" }
  const pending = quick.call("merge", "91")
  assert.equal(pending.code, 0, pending.text)
  assert.match(pending.text, /merge 91 --wait/)
  assert.equal(quick.effects("gh", "pr merge").length, 0)
})

test("merge --wait reads the ci rollup in the capitals GitHub GraphQL returns, so a red auto-merge PR fails at once instead of after 45 minutes", () => {
  const f = fixture({ queue: true })
  f.s.pull.autoMergeRequest = { mergeMethod: "SQUASH" }
  f.s.rollup = [
    {
      name: "ci",
      status: "COMPLETED",
      conclusion: "FAILURE",
      completedAt: "2026-11-13T00:00:00Z",
    },
  ]
  const r = f.call("merge", "91", "--wait")
  assert.equal(r.code, 2, r.text)
  assert.match(r.text, /REFUSED CI_FAILED: The ci check on head-1 is failure/)
  assert.doesNotMatch(r.text, /QUEUE_TIMEOUT/)
  assert.equal(f.effects("gh", "pr merge").length, 0)
})

test("every label the merge gate reads is defined in labels.yml", async () => {
  const { LABELS } = await import("../rules/index.mjs")
  const defined = readFileSync(
    new URL("../../../.github/labels.yml", import.meta.url),
    "utf8"
  )
  for (const label of Object.values(LABELS))
    assert.match(defined, new RegExp(`^- name: "?${label}"?$`, "m"), label)
})

const GATE_PATHS = [
  "scripts/ocv-tools/rules/merge-gate.mjs",
  "scripts/ocv-tools/rules/index.mjs",
  "scripts/ocv-tools/jobs/finish.mjs",
  "scripts/ocv-tools.mjs",
  "scripts/lib/ci-workflow.mjs",
  ".githooks/pre-push",
  ".github/labels.yml",
  ".github/workflows/nightly.yml",
  ".github/workflows/other.yml",
  ".github/actions/setup/action.yml",
  ".github/rulesets/main.json",
  "scripts/check.mjs",
]

test("a diff touching any file that decides what may merge needs owner-approved", async () => {
  const { evaluate } = await import("../rules/index.mjs")
  const facts = (files, labels) => ({
    pull: { n: 9, labels },
    diff: { files },
    migrations: { allowed: [], files: [] },
  })
  for (const file of GATE_PATHS) {
    const hit = evaluate("OWNER_YES", facts([file], []))
    assert.ok(hit, file)
    assert.match(
      hit.message,
      new RegExp(
        `${file.replaceAll(".", "\\.")} (decides what may merge|attests the ci check)`
      )
    )
    assert.equal(
      evaluate("OWNER_YES", facts([file], ["owner-approved"])),
      null,
      file
    )
  }
  for (const file of [
    "scripts/catalog.mjs",
    "scripts/lib/other.mjs",
    "scripts/ocv-tools-notes.md",
    "apps/api/src/app.ts",
    ".github/CODEOWNERS",
  ])
    assert.equal(evaluate("OWNER_YES", facts([file], [])), null, file)
})

test("a rename into or out of the gate folder is owner class, because the diff holds both sides", async () => {
  const { evaluate } = await import("../rules/index.mjs")
  const facts = (files) => ({
    pull: { n: 9, labels: [] },
    diff: { files },
    migrations: { allowed: [], files: [] },
  })
  const into = ["scripts/lib/helper.mjs", "scripts/ocv-tools/jobs/helper.mjs"]
  const out = [
    "scripts/ocv-tools/rules/merge-gate.mjs",
    "scripts/lib/merge-gate.mjs",
  ]
  assert.match(
    evaluate("OWNER_YES", facts(into)).message,
    /scripts\/ocv-tools\/jobs\/helper\.mjs decides what may merge/
  )
  assert.match(
    evaluate("OWNER_YES", facts(out)).message,
    /scripts\/ocv-tools\/rules\/merge-gate\.mjs decides what may merge/
  )
})

test("policy refuses a PR that edits the gate until owner-approved", () => {
  const bare = fixture({ changed: ["scripts/ocv-tools/rules/merge-gate.mjs"] })
  const refused = bare.call("policy", "91")
  assert.equal(refused.code, 2, refused.text)
  assert.match(
    refused.text,
    /OWNER_YES: .*scripts\/ocv-tools\/rules\/merge-gate\.mjs decides what may merge/
  )
  const yes = fixture({ changed: ["scripts/ocv-tools/rules/merge-gate.mjs"] })
  yes.s.pull.labels = [{ name: "owner-approved" }]
  assert.equal(yes.call("policy", "91").code, 0)
})
