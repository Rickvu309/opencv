import assert from "node:assert/strict"
import test from "node:test"
import { RULES } from "./index.mjs"

const row = (id) => RULES.find((item) => item.id === id)
const del = (files, lines, total) => ({
  diff: { deleted: { files, lines, total } },
})

test("MASS_DELETE trips on files, lines or percent, each at its own limit", () => {
  const rule = row("MASS_DELETE")
  assert.equal(rule.check(del(25, 2000, 1000)), null)
  assert.match(rule.check(del(26, 0, 1000)), /26 files \(limit 25\)/)
  assert.match(rule.check(del(1, 2001, 1000)), /2001 lines \(limit 2000\)/)
  assert.match(
    rule.check(del(11, 0, 100)),
    /11 of 100 authored files \(limit 10%\)/
  )
  assert.equal(rule.check(del(10, 0, 100)), null)
  assert.equal(rule.check({ diff: {} }), null)
  assert.deepEqual(rule.at, ["finish", "pr"])
  assert.match(rule.fix({}), /needs-human-review/)
})

test("PR_METADATA wants the title number, the closing line and an open issue", () => {
  const rule = row("PR_METADATA")
  const ok = {
    issue: 9,
    title: "fix(api): x y (#9)",
    body: "Closes #9\n",
    issueState: "OPEN",
  }
  assert.equal(rule.check({ pull: ok }), null)
  assert.match(rule.check({ pull: { ...ok, title: "x (#9)" } }), /title is not/)
  assert.match(
    rule.check({ pull: { ...ok, title: "fix: x (#8)" } }),
    /title is not/
  )
  assert.match(
    rule.check({ pull: { ...ok, body: "Closes #99" } }),
    /no "Closes #9"/
  )
  assert.match(
    rule.check({ pull: { ...ok, issueState: "CLOSED" } }),
    /issue #9 is closed/
  )
  assert.deepEqual(rule.at, ["finish", "pr"])
})
