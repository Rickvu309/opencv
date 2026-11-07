import assert from "node:assert/strict"
import test from "node:test"
import { fixture } from "./fixture.mjs"

for (const command of ["fetch", "rev-list", "merge-tree"]) {
  for (const silent of [false, true]) {
    test(`failed git ${command}${silent ? " without output" : ""} refuses before enqueue`, () => {
      const f = fixture({
        behind: 1,
        intercept(cmd, args) {
          if (cmd === "git" && args[0] === command)
            return {
              ok: false,
              out: "",
              err: silent ? "" : `injected ${command} failure`,
            }
        },
      })
      const result = f.call("merge", "91")
      assert.notEqual(result.code, 0)
      assert.match(result.text, /MERGED_TREE_FAILS/)
      assert.ok(result.text.includes(`git ${command} failed`), result.text)
      assert.doesNotMatch(result.text, /skipped/)
      assert.equal(f.effects("gh", "pr merge").length, 0)
      assert.equal(Boolean(f.s.enqueued), false)
      assert.equal(f.effects("gh", "issue close").length, 0)
    })
  }
}

test("failed merge-tree with a tree but no conflicts refuses before enqueue", () => {
  const f = fixture({
    behind: 1,
    intercept(cmd, args) {
      if (cmd === "git" && args[0] === "merge-tree")
        return { ok: false, out: `${"a".repeat(40)}\n`, err: "fatal: failed" }
    },
  })
  const result = f.call("merge", "91")
  assert.notEqual(result.code, 0)
  assert.match(result.text, /MERGED_TREE_FAILS/)
  assert.match(result.text, /git merge-tree failed: fatal: failed/)
  assert.equal(f.effects("gh", "pr merge").length, 0)
})
