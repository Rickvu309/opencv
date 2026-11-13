import assert from "node:assert/strict"
import test from "node:test"
import { world } from "./hook-world.mjs"

const GENERATED = "packages/domain/src/generated/catalog.ts"
const ADDED = "packages/domain/src/operations/job/priority-total/operation.ts"
const expected = { expected: { [GENERATED]: "export const catalog = 2\n" } }

const commit = (over) => {
  const w = world({ staged: [ADDED], ...over })
  return { w, r: w.call(["pre-commit"]) }
}

test("the mistake fixture fires: a new operation staged without a regenerated catalog is refused with the command to run", () => {
  const { r } = commit({
    catalog: expected,
    blobs: { [GENERATED]: { content: "export const catalog = 1\n" } },
  })
  assert.equal(r.code, 2, r.text)
  assert.match(
    r.text,
    /REFUSED CATALOG_STALE: the generated contract catalog is stale: packages\/domain\/src\/generated\/catalog\.ts/
  )
  assert.match(
    r.text,
    /Fix: Run node scripts\/catalog\.mjs generate, then git add/
  )
})

test("a contract the catalog cannot read is refused with its own error, not built silently", () => {
  const { r } = commit({
    catalog: {
      error: "missing-implementation: priority-total: job.priorityTotal",
    },
  })
  assert.equal(r.code, 2, r.text)
  assert.match(
    r.text,
    /could not be checked: missing-implementation: priority-total/
  )
  assert.match(r.text, /pnpm --filter @workspace\/domain build first/)
})

test("the clean fixture stays quiet: the staged catalog matches what generate writes", () => {
  const { r } = commit({
    catalog: expected,
    blobs: { [GENERATED]: { content: "export const catalog = 2\n" } },
  })
  assert.equal(r.code, 0, r.text)
})

const catalogRuns = (w) =>
  w.s.calls.filter((c) => String(c.args[0]).endsWith("catalog-expected.mjs"))
    .length

test("honest commits that cannot change the catalog never run it: no operation, server or generated file is staged", () => {
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
    assert.equal(catalogRuns(w), 0, staged.join(", "))
  }
})

test("only the commit checks the catalog: a push of a stale branch leaves it to CI", () => {
  const w = world({
    changed: [ADDED],
    catalog: expected,
    blobs: { [GENERATED]: { content: "stale\n" } },
  })
  const r = w.call(["pre-push"], {
    stdin:
      "refs/heads/feat/1-x abc refs/heads/feat/1-x 0000000000000000000000000000000000000000",
  })
  assert.doesNotMatch(r.text, /CATALOG_STALE/)
  assert.equal(catalogRuns(w), 0)
})
