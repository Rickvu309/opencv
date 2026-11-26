import assert from "node:assert/strict"
import test from "node:test"

import {
  changeMap,
  globPattern,
  holes,
  jobPart,
  readChangeGraph,
  replay,
} from "./change-map.mjs"

const graph = readChangeGraph()
const ALL = ["api", "formal", "web"]

test("a document or a script reaches no test part", () => {
  assert.deepEqual(changeMap(["docs/packs.md", "AGENTS.md"], graph).parts, [])
  assert.deepEqual(changeMap(["scripts/ui/screens.mjs"], graph).parts, [])
})

test("workflows, the lockfile and root configs reach every part", () => {
  for (const file of [
    ".github/workflows/ci.yml",
    "pnpm-lock.yaml",
    "turbo.json",
    "apps/api/turbo.json",
    "apps/web/package.json",
  ])
    assert.deepEqual(changeMap([file], graph).parts, ALL, file)
})

test("a path the graph does not know reaches every part and says which", () => {
  const map = changeMap(["infra/new-thing.tf"], graph)
  assert.deepEqual(map.parts, ALL)
  assert.match(map.reason, /infra\/new-thing\.tf is not in the graph/)
})

test("an api source file reaches api, formal and web, because web tests read api source", () => {
  assert.deepEqual(changeMap(["apps/api/src/job/store.ts"], graph).parts, ALL)
})

test("a web source file reaches web and api, because api tests read web source", () => {
  assert.deepEqual(
    changeMap(["apps/web/src/features/apply/apply-board.tsx"], graph).parts,
    ["api", "web"]
  )
})

test("a package reaches the apps that depend on it", () => {
  assert.deepEqual(
    changeMap(["packages/ui/src/components/button.tsx"], graph).parts,
    ["web"]
  )
  assert.deepEqual(changeMap(["packages/domain/src/job.ts"], graph).parts, ALL)
})

test("a script an app declares as a test input reaches that app", () => {
  assert.deepEqual(changeMap(["scripts/lib/write-grant.mjs"], graph).parts, [
    "api",
    "formal",
  ])
})

test("a glob matches across folders with ** and within one with *", () => {
  assert.ok(globPattern("apps/web/src/**").test("apps/web/src/a/b.ts"))
  assert.ok(!globPattern("apps/web/src/**").test("apps/web/vite.config.ts"))
  assert.ok(globPattern("scripts/*.mjs").test("scripts/a.mjs"))
  assert.ok(!globPattern("scripts/*.mjs").test("scripts/lib/a.mjs"))
})

test("a job belongs to the part named by its base name", () => {
  assert.equal(jobPart("test-api (2)"), "api")
  assert.equal(jobPart("test-web (3)"), "web")
  assert.equal(jobPart("formal-postgres"), "formal")
  assert.equal(jobPart("guards (ordinary)"), null)
})

test("a replay counts the minutes of jobs whose part the change does not reach", () => {
  const rows = replay(
    [{ number: 1, files: ["docs/a.md"] }],
    () => [
      { name: "test-api (1)", minutes: 3 },
      { name: "test-web (1)", minutes: 2 },
      { name: "guards (ordinary)", minutes: 1 },
    ],
    graph
  )
  assert.deepEqual(rows, [{ number: 1, parts: [], total: 6, saved: 5 }])
})

test("a red main run is a hole only when every failed job belongs to a skipped part", () => {
  const filesOf = () => ["docs/a.md"]
  assert.deepEqual(
    holes([{ pr: 7, run: 70, failed: ["test-api (1)"] }], filesOf, graph),
    [{ pr: 7, run: 70, skippedFailures: ["test-api (1)"] }]
  )
  assert.deepEqual(
    holes(
      [{ pr: 8, run: 80, failed: ["test-api (1)", "guards (ordinary)"] }],
      filesOf,
      graph
    ),
    []
  )
})
