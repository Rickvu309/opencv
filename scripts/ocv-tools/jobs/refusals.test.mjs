import assert from "node:assert/strict"
import test from "node:test"
import { fixture } from "./fixture.mjs"

test("a draft pull request is refused at merge but passes policy", () => {
  const f = fixture()
  f.s.pull.isDraft = true
  const policy = f.call("policy", "91")
  assert.equal(policy.code, 0, policy.text)
  const merged = f.call("merge", "91")
  assert.equal(merged.code, 2, merged.text)
  assert.match(merged.text, /REFUSED DRAFT: PR #91 is a draft\./)
  assert.match(merged.text, /Fix: Run: gh pr ready 91/)
  assert.equal(f.effects("gh", "pr merge").length, 0)
})

test("a merged pull request skips the pr rows and the ci check", () => {
  const f = fixture()
  Object.assign(f.s.pull, { state: "MERGED", mergeCommit: { oid: "m1" } })
  f.s.checks = []
  const r = f.call("merge", "91")
  assert.equal(r.code, 0, r.text)
  assert.equal(f.effects("gh", "pr merge").length, 0)
})

test("finish refuses a body with no Evidence section before any push", () => {
  const f = fixture()
  f.ctx.writeFile(
    `${f.ctx.cwd}/body.md`,
    "## Summary\n\nA change.\n\n## Merge Danger\n\n**Door:** two-way\n**Blast Radius:** jobs\n"
  )
  const r = f.call("finish", "--body-file", "body.md")
  assert.equal(r.code, 2, r.text)
  assert.match(r.text, /REFUSED BAD_BODY: The PR body needs ## Evidence\./)
  assert.equal(f.effects("git", "push").length, 0)
})

test("finish refuses a body file that cannot be read, even for a dry run", () => {
  const f = fixture()
  const r = f.call("finish", "--body-file", "missing.md", "--dry-run")
  assert.equal(r.code, 2, r.text)
  assert.match(r.text, /REFUSED BAD_BODY: .*missing\.md cannot be read/)
})

test("finish refuses unsaved work with the finish fix", () => {
  const f = fixture({ dirty: " M source.mjs" })
  const r = f.call("finish", "--body-file", "body.md")
  assert.equal(r.code, 2, r.text)
  assert.match(r.text, /REFUSED DIRTY: .*unsaved work/)
  assert.match(r.text, /Fix: Commit the changes, then run .*finish again/)
})

test("a failed ci check in the queue is a refusal that names the annotations", () => {
  let reads = 0
  const f = fixture({
    queue: true,
    inQueue: false,
    rollup: [
      {
        name: "ci",
        status: "completed",
        conclusion: "failure",
        completedAt: "2026-01-01T00:00:00Z",
      },
    ],
    intercept(cmd, a) {
      if (cmd !== "gh" || a[0] !== "api") return undefined
      if (a[1].includes("/annotations"))
        return {
          ok: true,
          out: JSON.stringify([
            { path: "a.mjs", start_line: 3, message: "Type error" },
          ]),
          err: "",
        }
      if (a[1].includes("/check-runs?") && ++reads > 1)
        return {
          ok: true,
          out: JSON.stringify({
            check_runs: [
              {
                id: 2,
                name: "ci",
                status: "completed",
                conclusion: "failure",
                head_sha: "head-1",
                html_url: "https://example.test/run/2",
              },
            ],
          }),
          err: "",
        }
      return undefined
    },
  })
  const r = f.call("merge", "91", "--wait")
  assert.equal(r.code, 2, r.text)
  assert.match(r.text, /REFUSED CI_FAILED: The ci check on head-1 is failure\./)
  assert.match(r.text, /Failing run: https:\/\/example\.test\/run\/2\./)
  assert.match(r.text, /a\.mjs:3 Type error/)
  assert.match(r.text, /Fix: Run: gh pr checks 91/)
  assert.equal(f.s.issueState, "OPEN")
})
