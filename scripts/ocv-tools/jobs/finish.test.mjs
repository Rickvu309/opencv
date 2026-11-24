import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { fixture } from "./fixture.mjs"

const finish = (f, ...args) =>
  f.call("finish", "--body-file", "body.md", ...args)
test("finish opens a draft with the branch title and closing line, with no proof", () => {
  const f = fixture()
  const r = finish(f, "--draft")
  assert.equal(r.code, 0, r.text)
  const effect = f.effects("gh", "pr create")[0]
  assert.ok(effect.args.includes("--draft"))
  assert.ok(effect.args.includes("feat: keep my search (#90)"))
  const file = effect.args[effect.args.indexOf("--body-file") + 1]
  assert.match(f.ctx.readFile(file), /Closes #90/)
  assert.doesNotMatch(f.ctx.readFile(file), /Quick check|retry/)
  assert.equal(f.effects("git", "push").length, 1)
})
test("finish opens a ready PR without --draft", () => {
  const f = fixture()
  assert.equal(finish(f).code, 0)
  assert.ok(!f.effects("gh", "pr create")[0].args.includes("--draft"))
})
test("finish reuses an existing PR and dry run has no push or create", () => {
  const f = fixture({
    existing: [
      {
        number: 91,
        url: "existing",
        title: "feat: keep my search (#90)",
        body: "Closes #90",
      },
    ],
  })
  assert.equal(finish(f).code, 0)
  const d = fixture()
  assert.equal(finish(d, "--dry-run").code, 0)
  assert.equal(d.effects("git", "push").length, 0)
  assert.equal(d.effects("gh", "pr create").length, 0)
})
test("finish preserves issue, checkout, workflow and commit gates", () => {
  for (const [over, code] of [
    [{ issueState: "CLOSED" }, "PR_METADATA"],
    [{ issueLabels: ["ready-for-human"] }, "READY_FOR_HUMAN"],
    [{ mainDirty: " M source" }, "MAIN_CLEAN"],
    [{ mainBranch: "feat/1-other" }, "MAIN_CLEAN"],
    [{ changed: [".github/workflows/other.yml"] }, "NO_WORKFLOWS"],
    [
      { changed: [".github/workflows/ci.yml"], deleteCi: true },
      "CI_WORKFLOW_KEPT",
    ],
    [{ commits: "Co-Authored-By: other" }, "NO_AI_ATTRIBUTION"],
    [{ changed: ["source.mjs"], size: 20001 }, "FILE_SIZE"],
  ]) {
    const f = fixture(over)
    const r = finish(f)
    assert.equal(r.code, 2, r.text)
    assert.match(r.text, new RegExp(code))
    assert.equal(f.effects("git", "push").length, 0)
  }
})
test("push failures and changes during push never create a PR", () => {
  for (const over of [{ pushOk: false }, { changeDuringPush: true }]) {
    const f = fixture(over)
    assert.notEqual(finish(f).code, 0)
    assert.equal(f.effects("gh", "pr create").length, 0)
  }
})
test("a failed finish push names the check and the first error line", () => {
  const f = fixture({
    pushOk: false,
    pushOut: "REFUSED QUICK_CHECKS: the quick checks failed: prettier\n",
    pushErr:
      "error: failed to push some refs to 'github.com:Rickvu309/opencv.git'\n",
  })
  const result = finish(f)
  assert.match(result.text, /QUICK_CHECKS/)
  assert.match(result.text, /prettier/)
  assert.match(
    result.text,
    /REFUSED QUICK_CHECKS: the quick checks failed: prettier/
  )
  assert.match(result.text, /Full log:/)
  assert.equal(f.effects("gh", "pr create").length, 0)
})
test("finish rejects malformed body and missing flags", () => {
  const f = fixture()
  f.ctx.writeFile(`${f.ctx.cwd}/body.md`, "## Summary\nOnly this")
  assert.match(finish(f).text, /BAD_BODY/)
  assert.equal(f.call("finish", "--body-file").code, 2)
  assert.equal(f.call("check", "--bogus").code, 2)
  assert.match(f.call("check", "--bogus").text, /UNKNOWN_FLAG/)
})

test("finish reports a failed create and refuses a branch with no new commits", () => {
  const f = fixture({ createOk: false })
  assert.equal(finish(f).code, 1)
  assert.equal(f.effects("gh", "pr create").length, 1)
  const unchecked = fixture({
    intercept(cmd, args) {
      if (cmd === "git" && args[0] === "rev-list")
        return { ok: true, out: "0", err: "" }
    },
  })
  assert.match(finish(unchecked).text, /NO_COMMITS/)
  assert.equal(unchecked.effects("git", "push").length, 0)
})

test("finish validates existing PR titles and closing links before reuse", () => {
  for (const metadata of [
    { title: "feat: keep my search (#89)", body: "Closes #90" },
    { title: "feat: keep my search (#90)", body: "Closes #89" },
  ]) {
    const f = fixture({
      existing: [{ number: 91, url: "existing", ...metadata }],
    })
    const result = finish(f)
    assert.equal(result.code, 2, result.text)
    assert.match(result.text, /PR_METADATA/)
    assert.equal(f.effects("git", "push").length, 0)
    assert.equal(f.effects("gh", "pr create").length, 0)
  }
})

test("finish prints the partial pass the receipt holds, one plain line per package", () => {
  const f = fixture()
  const read = f.ctx.ports.fs.read
  f.ctx.ports.fs.read = (path) =>
    /\/ocv-tools-affected-tests-v3-/.test(path)
      ? JSON.stringify({
          version: "v3",
          partial: [
            {
              runner: "apps/web",
              pkg: "web",
              ran: 27,
              reached: 143,
              leftOut: ["apps/web/src/a.test.tsx"],
            },
          ],
        })
      : read(path)
  const r = finish(f)
  assert.equal(r.code, 0, r.text)
  assert.match(
    r.text,
    /Local pre-check ran 27 of 143 tests this change reaches in apps\/web; CI runs the rest \(first left out: apps\/web\/src\/a\.test\.tsx\)\./
  )
  assert.match(
    r.text,
    /Local pre-check passed for the part of this change it ran; CI runs the rest and is the gate\./
  )
})

const MIGRATIONS = new URL("./migration-fixtures/", import.meta.url)
const sqlOf = (name) => readFileSync(new URL(`${name}.sql`, MIGRATIONS), "utf8")
const AUTO_REFUSED =
  "GraphQL: Auto merge is not allowed for this repository (enablePullRequestAutoMerge)"

function migrationWorld(tag, fixtureName, over = {}) {
  const file = `apps/api/drizzle/${tag}.sql`
  return fixture({
    autoOn: true,
    changed: ["apps/api/src/paper/store.ts", file],
    intercept(cmd, args) {
      if (cmd === "git" && args[0] === "show" && args[1].endsWith(file))
        return { ok: true, out: sqlOf(fixtureName), err: "" }
      return null
    },
    ...over,
  })
}

const autoAsks = (f) =>
  f.effects("gh", "pr merge").filter((e) => e.args.includes("--auto"))

test("an ordinary PR gets auto-merge", () => {
  const f = fixture({ autoOn: true, changed: ["apps/web/src/lib/jobs.ts"] })
  const r = finish(f)
  assert.equal(r.code, 0, r.text)
  const asks = autoAsks(f)
  assert.equal(asks.length, 1)
  assert.deepEqual(asks[0].args, [
    "pr",
    "merge",
    "91",
    "--squash",
    "--auto",
    "--match-head-commit",
    "base-1",
  ])
  assert.match(
    r.text,
    /Auto-merge is on: GitHub merges base-1 when ci is green/
  )
  assert.match(r.text, /why 91/)
})

test("ordinary, strict and high-risk PRs all get auto-merge", () => {
  for (const changed of [
    ["scripts/catalog.mjs"],
    ["apps/api/src/account/export-gate.ts"],
    ["apps/web/src/lib/paper-save.ts"],
  ]) {
    const f = fixture({ autoOn: true, changed })
    assert.equal(finish(f).code, 0)
    assert.equal(autoAsks(f).length, 1, changed[0])
  }
  for (const changed of [
    [".github/workflows/ci.yml"],
    [".github/actions/setup/action.yml"],
    ["scripts/check.mjs"],
  ]) {
    const f = fixture({ autoOn: true, changed, issueLabels: ["risk:high"] })
    const r = finish(f)
    assert.equal(r.code, 0, r.text)
    assert.equal(autoAsks(f).length, 1, changed[0])
    assert.match(r.text, /Auto-merge is on/)
  }
})

test("a migration that changes existing things needs its allow label; an only-adds migration does not", () => {
  const owner = migrationWorld(
    "0024_word_rename_retained",
    "pr-1407-0024_word_rename_retained"
  )
  const r = finish(owner)
  assert.equal(r.code, 0, r.text)
  assert.equal(owner.effects("gh", "pr merge").length, 0)
  assert.match(r.text, /Auto-merge is off: MIGRATION_CHANGES/)
  const allowed = migrationWorld(
    "0024_word_rename_retained",
    "pr-1407-0024_word_rename_retained"
  )
  allowed.s.pull.labels = [
    { name: "allow-migration:0024_word_rename_retained" },
  ]
  const passed = finish(allowed)
  assert.equal(passed.code, 0, passed.text)
  assert.equal(autoAsks(allowed).length, 1)
  const adds = migrationWorld(
    "0023_package_trash",
    "pr-1407-0023_package_trash"
  )
  assert.equal(finish(adds).code, 0)
  assert.equal(autoAsks(adds).length, 1)
})

test("when GitHub refuses auto-merge, finish still succeeds and says the old way in one line", () => {
  const f = fixture({ autoRefused: AUTO_REFUSED })
  const r = finish(f)
  assert.equal(r.code, 0, r.text)
  assert.equal(f.effects("gh", "pr merge").length, 1)
  const said = r.text.split("\n").filter((line) => /Auto-merge/.test(line))
  assert.deepEqual(said, [
    `Auto-merge was refused (${AUTO_REFUSED}), so this PR merges the old way: the coordinator runs merge 91.`,
  ])
  assert.match(r.text, /Next: scripts\/ocv-tools\.mjs merge 91/)
})

test("finish leaves auto-merge off while production is red, and for a draft", () => {
  const red = fixture({
    autoOn: true,
    redIssues: [
      { number: 1600, state: "OPEN", labels: [{ name: "production-red" }] },
    ],
  })
  const r = finish(red)
  assert.equal(r.code, 0, r.text)
  assert.match(
    r.text,
    /Auto-merge is off: QUEUE_CLOSED production is red \(#1600 open\)/
  )
  assert.equal(red.effects("gh", "pr merge").length, 0)
  const draft = fixture({ autoOn: true })
  assert.equal(finish(draft, "--draft").code, 0)
  assert.equal(draft.effects("gh", "pr merge").length, 0)
})

test("a PR that edits the merge gate enables auto-merge without approval", () => {
  const f = fixture({
    autoOn: true,
    changed: ["scripts/ocv-tools/rules/merge-gate.mjs"],
  })
  const r = finish(f)
  assert.equal(r.code, 0, r.text)
  assert.equal(autoAsks(f).length, 1)
  assert.match(r.text, /Auto-merge is on/)
})
