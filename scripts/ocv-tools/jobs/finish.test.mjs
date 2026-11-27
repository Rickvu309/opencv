import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { BODY, PROOF_TREE, fixture } from "./fixture.mjs"

function uploadedBody(f) {
  const { args } = f.effects("gh", "pr create")[0]
  return f.ctx.readFile(args[args.indexOf("--body-file") + 1])
}

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
test("finish keeps the supplied closing line and folds retired checks", () => {
  const f = fixture({
    intercept(cmd, args) {
      if (cmd === "git" && args[0] === "diff" && args.includes("--raw"))
        return {
          ok: true,
          out: ":000000 100644 0000 retirement A\0scripts/retired/90.json\0",
        }
      if (cmd === "git" && args.join(" ") === "cat-file blob retirement")
        return {
          ok: true,
          out: JSON.stringify([{ subject: "obsolete check", items: 1 }]),
        }
    },
  })
  const text = `${BODY}\nCloses #90\n`
  f.ctx.writeFile(`${f.ctx.cwd}/body.md`, text)
  const r = finish(f, "--draft")
  assert.equal(r.code, 0, r.text)
  assert.match(r.text, /Retired 1 check/)
  const body = uploadedBody(f)
  assert.ok(body.startsWith(text))
  assert.equal(body.match(/Closes #90/g).length, 1)
  assert.match(
    body,
    /<details><summary>Retired checks<\/summary>\n\nRetired 1 check[^\n]+\n\n<\/details>/
  )
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
test("finish refuses a closed issue and a main checkout that is not clean main before it pushes", () => {
  for (const [over, code] of [
    [{ issueState: "CLOSED" }, "PR_METADATA"],
    [{ mainDirty: " M source" }, "MAIN_CLEAN"],
    [{ mainBranch: "feat/1-other" }, "MAIN_CLEAN"],
  ]) {
    const f = fixture(over)
    const r = finish(f)
    assert.equal(r.code, 2, r.text)
    assert.match(r.text, new RegExp(code))
    assert.equal(f.effects("git", "push").length, 0)
  }
})
test("finish does not judge the rules ci judges before it opens the pull request; it opens it and leaves auto-merge off with the rule named", () => {
  for (const [over, code] of [
    [{ issueLabels: ["ready-for-human"] }, "READY_FOR_HUMAN"],
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
    assert.equal(r.code, 0, `${code}: ${r.text}`)
    assert.equal(f.effects("gh", "pr create").length, 1, code)
    assert.match(r.text, new RegExp(`Auto-merge is off: ${code}`))
    assert.equal(
      f.effects("gh", "pr merge").filter((e) => e.args.includes("--auto"))
        .length,
      0,
      code
    )
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
  f.ctx.writeFile(`${f.ctx.cwd}/body.md`, "**Now:** Only this")
  assert.match(finish(f).text, /BAD_BODY/)
  assert.equal(f.call("finish", "--body-file").code, 2)
  assert.match(f.call("finish", "--bogus").text, /UNKNOWN_FLAG/)
})

test("finish and its dry run refuse a screen pull request without screenshots or a reason", () => {
  for (const flags of [[], ["--dry-run"]]) {
    const f = fixture({ changed: ["packages/ui/src/components/button.tsx"] })
    f.ctx.writeFile(`${f.ctx.cwd}/body.md`, PROOF_TREE)
    const refused = finish(f, ...flags)
    assert.equal(refused.code, 2, refused.text)
    assert.match(refused.text, /REFUSED NO_BEFORE_AFTER/)
    assert.equal(f.effects("git", "push").length, 0)
    assert.equal(f.effects("gh", "pr create").length, 0)

    f.ctx.writeFile(
      `${f.ctx.cwd}/body.md`,
      `${PROOF_TREE}\n## Before / after\n\nNo visible change: The button markup moved unchanged.\n`
    )
    const accepted = finish(f, ...flags)
    assert.equal(accepted.code, 0, accepted.text)
  }
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

const MIGRATIONS = new URL("./migration-fixtures/", import.meta.url)
const sqlOf = (name) => readFileSync(new URL(`${name}.sql`, MIGRATIONS), "utf8")
const AUTO_REFUSED =
  "GraphQL: Auto merge is not allowed for this repository (enablePullRequestAutoMerge)"

function migrationWorld(tag, fixtureName, over = {}) {
  const file = `apps/api/drizzle/${tag}.sql`
  const f = fixture({
    autoOn: true,
    changed: ["apps/api/src/paper/store.ts", file],
    intercept(cmd, args) {
      if (cmd === "git" && args[0] === "show" && args[1].endsWith(file))
        return { ok: true, out: sqlOf(fixtureName), err: "" }
      return null
    },
    ...over,
  })
  f.ctx.writeFile(`${f.ctx.cwd}/body.md`, `${BODY}\n**Risk:** Runs ${tag}.\n`)
  return f
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

test("finish and its dry run refuse an additive migration without Risk", () => {
  for (const flags of [[], ["--dry-run"]]) {
    const f = migrationWorld("0023_package_trash", "pr-1407-0023_package_trash")
    f.ctx.writeFile(`${f.ctx.cwd}/body.md`, BODY)
    const r = finish(f, ...flags)
    assert.equal(r.code, 2, r.text)
    assert.match(r.text, /REFUSED BAD_BODY: .*migration needs a \*\*Risk:\*\*/)
    assert.equal(f.effects("git", "push").length, 0)
    assert.equal(f.effects("gh", "pr create").length, 0)
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
