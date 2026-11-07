import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect } from "../../lib/local-policy-diff.mjs"
import { fixture } from "./fixture.mjs"
import { pullFacts } from "./pull-facts.mjs"
import { policyReport } from "./policy.mjs"

test("policy never asks the size-limited GitHub diff API for changed paths", () => {
  assert.deepEqual(
    detect(readFileSync(new URL("./pull-facts.mjs", import.meta.url), "utf8")),
    []
  )
  assert.deepEqual(
    detect('gh(ctx, "pr", "diff", String(n), "--name-only")'),
    [1]
  )
  assert.deepEqual(
    detect('git(ctx, "diff", "--no-renames", "--name-only", "-z", base, head)'),
    []
  )
})

test("a complete local diff retains paths past the API limit, newlines and both rename sides", () => {
  const changed = [
    ...Array.from({ length: 20001 }, (_, i) => `source/${i}.mjs`),
    "old/name.mjs",
    "new/name.mjs",
    "line\nbreak.mjs",
    ".github/workflows/other.yml",
  ]
  const f = fixture({
    changed,
    intercept(cmd, args) {
      if (cmd === "gh" && args[0] === "pr" && args[1] === "diff")
        throw new Error("HTTP 406: diff exceeds 20000 lines")
    },
  })
  const facts = pullFacts(f.ctx, 91)
  assert.deepEqual(facts.diff.files, changed)
  assert.match(policyReport(91, facts).lines.join("\n"), /NO_WORKFLOWS/)
  assert.equal(f.effects("gh", "pr diff").length, 0)
})
