import assert from "node:assert/strict"
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
  assert.equal(f.call("check").code, 2)
  assert.match(f.call("check").text, /UNKNOWN_COMMAND/)
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
