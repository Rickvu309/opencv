import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fixture } from "./fixture.mjs"

test("check saves a passing proof for the committed tree and base, disabling dry run", () => {
  const f = fixture()
  const r = f.call("check")
  assert.equal(r.code, 0, r.text)
  assert.match(r.text, /tree-1/)
  const proof = JSON.parse(
    f.ctx.readFile(`${f.ports.git.here(f.ctx.cwd).gitDir}/ocv-tools-check.json`)
  )
  assert.equal(proof.tree, "tree-1")
  assert.equal(proof.base, "base-1")
  assert.equal(f.s.checkEnv.CHECK_DRY_RUN, "")
  const record = JSON.parse(
    readFileSync(
      join(f.ctx.env.PR_RESULT_DIR, "opencv-check-feat-90-keep-my-search.json"),
      "utf8"
    )
  )
  assert.equal(record.schema, 1)
  assert.equal(record.status, "ok")
})
test("failed recheck invalidates earlier passing proof and returns exit 1", () => {
  const f = fixture()
  assert.equal(f.call("check").code, 0)
  f.s.checkOk = false
  assert.equal(f.call("check").code, 1)
  assert.equal(f.call("finish", "--body-file", "body.md").code, 2)
})
test("dirty work and a tree that changes during a check cannot earn proof", () => {
  for (const over of [{ dirty: " M source" }, { changeDuringCheck: true }]) {
    const f = fixture(over)
    assert.equal(f.call("check").code, 2)
  }
})

test("check carries retry evidence into the PR body", () => {
  const f = fixture({
    intercept(cmd) {
      if (cmd === "node")
        return { ok: true, out: "RESULT_JSON: child-result.json", err: "" }
    },
  })
  f.ctx.writeFile(
    "child-result.json",
    JSON.stringify({
      schema: 1,
      script: "check",
      status: "ok",
      retried: ["flaky.test.mjs"],
    })
  )
  assert.equal(f.call("check").code, 0)
  assert.equal(f.call("finish", "--body-file", "body.md").code, 0)
  const args = f.effects("gh", "pr create")[0].args
  assert.match(
    f.ctx.readFile(args[args.indexOf("--body-file") + 1]),
    /Passed only on retry: flaky.test.mjs/
  )
})
