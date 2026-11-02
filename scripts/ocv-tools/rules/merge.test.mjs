import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { RULES } from "./index.mjs"
import { CHANGE_SIZE_LIMIT, countedSourceFiles } from "./diff.mjs"

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

const changesOf = (number) =>
  readFileSync(
    new URL(`change-size-fixtures/pr-${number}.txt`, import.meta.url),
    "utf8"
  )
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [added, deleted, path] = line.split("\t")
      return { path, added: Number(added), deleted: Number(deleted) }
    })
const fileChanges = (count, extra = {}) =>
  Array.from({ length: count }, (_, i) => ({
    path: `apps/web/src/file-${i}.ts`,
    added: 3,
    deleted: 1,
    ...extra,
  }))
const sized = (changes) => ({ diff: { changes } })

test("CHANGE_TOO_BIG refuses the three biggest past changes and passes a normal one", () => {
  const rule = row("CHANGE_TOO_BIG")
  assert.deepEqual(rule.at, ["finish", "pr"])
  assert.match(
    rule.check(sized(changesOf(509))),
    /54 authored source files \(limit 25\).*split it into sub-issues/
  )
  assert.match(rule.check(sized(changesOf(392))), /34 authored source files/)
  assert.match(rule.check(sized(changesOf(645))), /71 authored source files/)
  assert.equal(rule.check(sized(changesOf(904))), null)
})

test("CHANGE_TOO_BIG counts the limit itself as fine and one more as too big", () => {
  const rule = row("CHANGE_TOO_BIG")
  assert.equal(CHANGE_SIZE_LIMIT, 25)
  assert.equal(rule.check(sized(fileChanges(25))), null)
  assert.match(rule.check(sized(fileChanges(26))), /26 authored source files/)
  assert.equal(rule.check({ diff: {} }), null)
  assert.match(rule.fix({}), /sub-issues.*label the issue needs-human-review/)
})

test("CHANGE_TOO_BIG ignores tests, snapshots, layouts, lockfile, generated files, pure deletions and pure renames", () => {
  const rule = row("CHANGE_TOO_BIG")
  const ignored = [
    ...fileChanges(40).map((c) => ({
      ...c,
      path: c.path.replace(".ts", ".test.tsx"),
    })),
    ...fileChanges(40).map((c) => ({
      ...c,
      path: c.path.replace("src/", "src/test/"),
    })),
    ...fileChanges(40).map((c) => ({
      ...c,
      path: c.path.replace(".ts", ".snapshot.json"),
    })),
    ...fileChanges(40).map((c) => ({
      ...c,
      path: c.path.replace(".ts", ".layout.json"),
    })),
    { path: "pnpm-lock.yaml", added: 900, deleted: 800 },
    ...fileChanges(40, { generated: true }),
    ...fileChanges(40, { added: 0, deleted: 12 }),
    ...fileChanges(40, { added: 0, deleted: 0 }),
  ]
  assert.deepEqual(countedSourceFiles(ignored), [])
  assert.equal(rule.check(sized(ignored)), null)
  assert.equal(rule.check(sized([...ignored, ...fileChanges(25)])), null)
  assert.match(rule.check(sized([...ignored, ...fileChanges(26)])), /26 /)
})

test("CHANGE_TOO_BIG passes when the issue carries needs-human-review, and refuses without it", () => {
  const rule = row("CHANGE_TOO_BIG")
  const big = (labels) => ({
    diff: { changes: changesOf(509), labels },
  })
  assert.match(rule.check(big([])), /54 authored source files/)
  assert.match(rule.check(big(["risk:high"])), /54 authored source files/)
  assert.equal(rule.check(big(["needs-human-review"])), null)
  assert.match(
    rule.check(big([])),
    /split it into sub-issues.*ask the owner to label the issue needs-human-review/
  )
})

test("an agent merge stays refused on a change the issue label let through", () => {
  const facts = {
    pull: {
      n: 9,
      isDraft: false,
      labels: [],
      branch: "feat/9-big",
      state: "OPEN",
      head: "h",
      author: "Owner",
    },
    issue: { n: 9, labels: ["needs-human-review"] },
    diff: { changes: changesOf(509), labels: ["needs-human-review"] },
    me: "Owner",
    ci: { status: "completed", conclusion: "success", head: "h" },
  }
  assert.equal(row("CHANGE_TOO_BIG").check(facts), null)
  assert.equal(
    row("NEEDS_HUMAN_REVIEW").check(facts),
    "PR #9 needs human review; an agent never merges it."
  )
})
