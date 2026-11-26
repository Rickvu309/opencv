import assert from "node:assert/strict"
import test from "node:test"

import { readChangeGraph } from "./change-map.mjs"
import {
  commandsFor,
  packOf,
  pickTests,
  readWorld,
  UNKNOWN_TEST_SECONDS,
} from "./test-pick.mjs"

const graph = readChangeGraph()

function world(overrides = {}) {
  return {
    graph,
    workspaces: ["apps/api", "apps/web", "packages/domain"],
    workspaceEdges: [
      ["apps/api", "packages/domain"],
      ["apps/web", "packages/domain"],
    ],
    packs: [
      { dir: "apps/api/src/job", dependencies: ["apps/api/src/db"] },
      { dir: "apps/api/src/db", dependencies: [] },
      {
        dir: "apps/api/src/coach/chat",
        dependencies: ["apps/api/src/job"],
      },
      { dir: "apps/api/src/paper", dependencies: ["apps/api/src/db"] },
      { dir: "packages/domain/src/apply", dependencies: [] },
    ],
    testFiles: [
      "apps/api/src/job/board.test.ts",
      "apps/api/src/coach/chat/chat.test.ts",
      "apps/api/src/paper/paper.test.ts",
      "apps/api/src/app.test.ts",
      "apps/web/src/features/apply/board.test.tsx",
      "packages/domain/src/operation.test.ts",
    ],
    seconds: {
      "apps/api/src/job/board.test.ts": 5,
      "apps/api/src/coach/chat/chat.test.ts": 4,
      "apps/api/src/paper/paper.test.ts": 1,
      "apps/api/src/app.test.ts": 1,
    },
    ...overrides,
  }
}

test("a file belongs to its deepest pack, or to its workspace when no pack holds it", () => {
  const dirs = ["apps/api/src/coach", "apps/api/src/coach/chat"]
  assert.equal(
    packOf("apps/api/src/coach/chat/x.ts", dirs),
    "apps/api/src/coach/chat"
  )
  assert.equal(packOf("apps/api/src/coach/y.ts", dirs), "apps/api/src/coach")
  assert.equal(packOf("apps/api/src/app.ts", dirs), "apps/api")
})

test("the changed pack's tests come first, then the packs that depend on it, then the rest of its workspace, then other workspaces", () => {
  const picked = pickTests(["apps/api/src/job/store.ts"], world(), 1000)
  assert.deepEqual(picked.run, [
    "apps/api/src/job/board.test.ts",
    "apps/api/src/coach/chat/chat.test.ts",
    "apps/api/src/app.test.ts",
    "apps/api/src/paper/paper.test.ts",
    "apps/web/src/features/apply/board.test.tsx",
  ])
  assert.deepEqual(picked.ciOnly, [])
})

test("a change reaches no workspace that does not depend on it", () => {
  const picked = pickTests(["apps/api/src/job/store.ts"], world(), 1000)
  assert.ok(!picked.run.includes("packages/domain/src/operation.test.ts"))
})

test("the budget stops the list, and what is left is named for CI", () => {
  const picked = pickTests(["apps/api/src/job/store.ts"], world(), 9)
  assert.deepEqual(picked.run, [
    "apps/api/src/job/board.test.ts",
    "apps/api/src/coach/chat/chat.test.ts",
  ])
  assert.deepEqual(picked.ciOnly, [
    "apps/api/src/app.test.ts",
    "apps/api/src/paper/paper.test.ts",
    "apps/web/src/features/apply/board.test.tsx",
  ])
  assert.equal(picked.seconds, 9)
})

test("a test with no recorded time counts as the unknown default", () => {
  const picked = pickTests(
    ["apps/web/src/features/apply/board.tsx"],
    world(),
    UNKNOWN_TEST_SECONDS
  )
  assert.deepEqual(picked.run, ["apps/web/src/features/apply/board.test.tsx"])
  assert.equal(picked.seconds, UNKNOWN_TEST_SECONDS)
})

test("a contract change reaches its own workspace first, then every workspace that depends on it", () => {
  const picked = pickTests(["packages/domain/src/apply/job.ts"], world(), 1000)
  assert.equal(picked.run[0], "packages/domain/src/operation.test.ts")
  assert.equal(picked.run.length, 6)
})

test("a document reaches no test, and the lockfile reaches every workspace with its reason", () => {
  assert.deepEqual(pickTests(["docs/packs.md"], world(), 1000).run, [])
  const all = pickTests(["pnpm-lock.yaml"], world(), 1000)
  assert.equal(all.run.length, 6)
  assert.match(all.reason, /pnpm-lock\.yaml reaches every part/)
})

test("commands run each workspace's own test script on its files", () => {
  assert.deepEqual(
    commandsFor(
      [
        "apps/api/src/job/board.test.ts",
        "packages/domain/src/operation.test.ts",
      ],
      {
        "apps/api": "vitest run",
        "packages/domain":
          "node --experimental-strip-types --import ./register-ts.mjs --test src/*.test.ts",
      }
    ),
    [
      "(cd apps/api && npx vitest run src/job/board.test.ts)",
      "(cd packages/domain && node --experimental-strip-types --import ./register-ts.mjs --test src/operation.test.ts)",
    ]
  )
})

test("on the real tree, an Apply change lists Apply first and only reaches Apply's dependents before the rest of the api", () => {
  const real = readWorld()
  const picked = pickTests(["apps/api/src/job/store.ts"], real, 60)
  assert.ok(picked.run[0].startsWith("apps/api/src/job/"))
  const firstOutside = picked.run.findIndex(
    (file) => !file.startsWith("apps/api/src/job/")
  )
  for (const file of picked.run.slice(firstOutside, firstOutside + 3))
    assert.match(
      file,
      /^apps\/api\/src\/(coach|scenarios|test|[^/]+\.test\.ts)/,
      file
    )
  assert.ok(picked.ciOnly.length > 0)
})
