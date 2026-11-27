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

test("finish refuses a body with no Proof line before any push", () => {
  const f = fixture()
  f.ctx.writeFile(`${f.ctx.cwd}/body.md`, "**Now:** A change.\n")
  const r = f.call("finish", "--body-file", "body.md")
  assert.equal(r.code, 2, r.text)
  assert.match(r.text, /REFUSED BAD_BODY: .*\*\*Now:\*\*.*\*\*Proof:\*\*/)
  assert.equal(f.effects("git", "push").length, 0)
})

test("finish refuses a body file that cannot be read, even for a dry run", () => {
  const f = fixture()
  const r = f.call("finish", "--body-file", "missing.md", "--dry-run")
  assert.equal(r.code, 2, r.text)
  assert.match(r.text, /REFUSED BAD_BODY: .*missing\.md cannot be read/)
})

test("a dry run checks only the body, so unsaved work does not stop it", () => {
  const f = fixture({ dirty: " M source.mjs" })
  const r = f.call("finish", "--body-file", "body.md", "--dry-run")
  assert.equal(r.code, 0, r.text)
  assert.match(r.text, /DRY RUN: the body passes/)
  assert.equal(f.effects("git", "push").length, 0)
  assert.equal(f.effects("git", "fetch").length, 0)
  assert.equal(f.effects("gh", "pr create").length, 0)
})

test("a dry run names every body problem in one message", () => {
  const f = fixture({ dirty: " M source.mjs" })
  f.ctx.writeFile(
    `${f.ctx.cwd}/thin.md`,
    "**Now:** Only this <screenshot>.\nLog at /home/me/log.\n"
  )
  const r = f.call("finish", "--body-file", "thin.md", "--dry-run")
  assert.equal(r.code, 2, r.text)
  assert.match(
    r.text,
    /REFUSED BAD_BODY: 3 problems\. \(1\) Start the PR body.*\*\*Proof:\*\*.*\(2\) Fill in all template placeholders\. \(3\) The PR body names a path on your machine/
  )
})

test("finish refuses unsaved work with the finish fix", () => {
  const f = fixture({ dirty: " M source.mjs" })
  const r = f.call("finish", "--body-file", "body.md")
  assert.equal(r.code, 2, r.text)
  assert.match(r.text, /REFUSED DIRTY: .*unsaved work/)
  assert.match(r.text, /Fix: Commit the changes, then run .*finish again/)
})
