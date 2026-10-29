import assert from "node:assert/strict"
import test from "node:test"
import { fixture } from "./fixture.mjs"

const finish = (f, ...args) =>
  f.call("finish", "--body-file", "body.md", ...args)
test("finish refuses missing or stale check proof before pushing", () => {
  const f = fixture()
  assert.match(finish(f).text, /CHECK_REQUIRED/)
  f.call("check")
  f.s.tree = "tree-2"
  assert.match(finish(f).text, /CHECK_REQUIRED/)
  f.s.tree = "tree-1"
  f.s.base = "base-2"
  assert.match(finish(f).text, /CHECK_REQUIRED/)
  assert.equal(f.effects("git", "push").length, 0)
})
test("finish opens a draft with the branch title, closing line and check proof", () => {
  const f = fixture()
  f.call("check")
  const r = finish(f, "--draft")
  assert.equal(r.code, 0, r.text)
  const effect = f.effects("gh", "pr create")[0]
  assert.ok(effect.args.includes("--draft"))
  assert.ok(effect.args.includes("feat: keep my search (#90)"))
  const file = effect.args[effect.args.indexOf("--body-file") + 1]
  assert.match(f.ctx.readFile(file), /Closes #90/)
  assert.match(
    f.ctx.readFile(file),
    /Quick check passed for tree `tree-1` against `base-1`/
  )
})
test("finish reuses an existing PR and dry run has no push or create", () => {
  const f = fixture({ existing: [{ number: 91, url: "existing" }] })
  assert.equal(finish(f).code, 0)
  const d = fixture()
  assert.equal(finish(d, "--dry-run").code, 0)
  assert.equal(d.effects("git", "push").length, 0)
  assert.equal(d.effects("gh", "pr create").length, 0)
})
test("finish preserves issue, checkout, workflow and commit gates", () => {
  for (const [over, code] of [
    [{ issueState: "CLOSED" }, "CLOSED"],
    [{ issueLabels: ["ready-for-human"] }, "READY_FOR_HUMAN"],
    [{ mainDirty: " M source" }, "MAIN_CLEAN"],
    [{ mainBranch: "feat/1-other" }, "MAIN_CLEAN"],
    [{ changed: [".github/workflows/other.yml"] }, "NO_WORKFLOWS"],
    [
      { changed: [".github/workflows/ci.yml"], deleteCi: true },
      "CI_WORKFLOW_KEPT",
    ],
    [{ commits: "Co-Authored-By: other" }, "COMMITS_HOOKED"],
    [{ changed: ["source.mjs"], size: 20001 }, "COMMITS_HOOKED"],
  ]) {
    const f = fixture(over)
    f.call("check")
    const r = finish(f)
    assert.equal(r.code, 2, r.text)
    assert.match(r.text, new RegExp(code))
    assert.equal(f.effects("git", "push").length, 0)
  }
})
test("push failures and changes during push never create a PR", () => {
  for (const over of [{ pushOk: false }, { changeDuringPush: true }]) {
    const f = fixture(over)
    f.call("check")
    assert.notEqual(finish(f).code, 0)
    assert.equal(f.effects("gh", "pr create").length, 0)
  }
})
test("finish rejects malformed body and missing flags", () => {
  const f = fixture()
  f.ctx.writeFile(`${f.ctx.cwd}/body.md`, "## Summary\nOnly this")
  assert.match(finish(f).text, /BAD_BODY/)
  assert.equal(f.call("finish", "--body-file").code, 2)
  assert.equal(f.call("check", "--draft").code, 2)
})

test("finish reports a failed create and refuses a branch with no new commits", () => {
  const f = fixture({ createOk: false })
  f.call("check")
  assert.equal(finish(f).code, 1)
  assert.equal(f.effects("gh", "pr create").length, 1)
  const unchecked = fixture({
    intercept(cmd, args) {
      if (cmd === "git" && args[0] === "rev-list")
        return { ok: true, out: "0", err: "" }
    },
  })
  unchecked.call("check")
  assert.match(finish(unchecked).text, /NO_COMMITS/)
  assert.equal(unchecked.effects("git", "push").length, 0)
})
