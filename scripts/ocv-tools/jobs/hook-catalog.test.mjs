import assert from "node:assert/strict"
import test from "node:test"
import { world } from "./hook-world.mjs"

const GENERATED = "packages/domain/src/generated/catalog.ts"
const ADDED = "packages/domain/src/operations/job/priority-total/operation.ts"

const commit = (over) => {
  const w = world({ staged: [ADDED], ...over })
  return { w, r: w.call(["pre-commit"]) }
}

const judgeRuns = (w) =>
  w.s.calls.filter(
    (c) => c.cmd === "node" && String(c.args[0]).endsWith("catalog-judge.mjs")
  )

test("the mistake fixture fires: a staged tree whose catalog is stale is refused with the command to run", () => {
  const { r } = commit({ catalog: { stale: [GENERATED] } })
  assert.equal(r.code, 2, r.text)
  assert.match(
    r.text,
    /REFUSED CATALOG_STALE: the tree this commit records has a stale generated contract catalog: packages\/domain\/src\/generated\/catalog\.ts/
  )
  assert.match(r.text, /Fix: Stage every operation and server file/)
  assert.doesNotMatch(r.text, /git add packages\/domain\/src\/generated/)
})

test("the judge reads a copy of the index in a scratch folder, never the working tree", () => {
  const { w } = commit({ catalog: { stale: [] } })
  const [judge] = judgeRuns(w)
  assert.ok(judge, "the judge ran")
  assert.match(String(judge.args[1]), /^\/scratch\/catalog-index-/)
  const copy = w.s.calls.find((c) => c.args[0] === "checkout-index")
  assert.ok(copy.args.includes(`--prefix=${judge.args[1]}/`))
})

test("a contract the catalog cannot read is refused with its own error", () => {
  const { r } = commit({
    catalog: { error: "missing-implementation: priority-total" },
  })
  assert.equal(r.code, 2, r.text)
  assert.match(
    r.text,
    /could not be checked: missing-implementation: priority-total/
  )
})

test("untracked operation files beside a staged catalog are refused by name, and the judge does not run", () => {
  const untracked = [1, 2, 3, 4].map(
    (n) => `packages/domain/src/operations/job/new-${n}/operation.ts`
  )
  const { w, r } = commit({
    staged: [GENERATED],
    untracked,
    catalog: { stale: [] },
  })
  assert.equal(r.code, 2, r.text)
  assert.match(
    r.text,
    /these operation files are not staged: packages\/domain\/src\/operations\/job\/new-1\/operation\.ts, .*new-3\/operation\.ts and 1 more; add them or remove them, then commit/
  )
  assert.equal(judgeRuns(w).length, 0)
})

test("the clean fixture stays quiet: the staged catalog matches the staged tree", () => {
  const { r } = commit({ staged: [ADDED, GENERATED], catalog: { stale: [] } })
  assert.equal(r.code, 0, r.text)
})

test("honest commits that cannot change the catalog never run it", () => {
  for (const staged of [
    ["apps/web/src/a.tsx"],
    ["docs/agents/notes.md", "README.md"],
    ["packages/domain/src/paper-word.ts", "packages/domain/src/job.ts"],
    [
      "apps/api/drizzle/0026_add_index.sql",
      "apps/api/drizzle/meta/_journal.json",
    ],
  ]) {
    const { w, r } = commit({ staged, catalog: { error: "x" } })
    assert.equal(r.code, 0, r.text)
    assert.equal(judgeRuns(w).length, 0, staged.join(", "))
  }
})

test("a push leaves the catalog to the push-time catalog test and CI", () => {
  const w = world({ changed: [ADDED], catalog: { stale: [GENERATED] } })
  const r = w.call(["pre-push"], {
    stdin:
      "refs/heads/feat/1-x abc refs/heads/feat/1-x 0000000000000000000000000000000000000000",
  })
  assert.doesNotMatch(r.text, /CATALOG_STALE/)
  assert.equal(judgeRuns(w).length, 0)
})
