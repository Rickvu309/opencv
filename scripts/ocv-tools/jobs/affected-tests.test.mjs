import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  HUB_IMPORTERS,
  MAX_PER_RUNNER,
  SCANS_THE_TREE,
  TREE_SCANS,
  describeSelection,
  importedStems,
  selectTests,
} from "./affected-tests.mjs"

const root = fileURLToPath(new URL("../../../", import.meta.url))
const picked = (selection) =>
  Object.fromEntries(
    selection.groups.flatMap((group) =>
      group.files.map((item) => [item.file, item.why])
    )
  )
const select = (changed, tests, texts = {}) =>
  selectTests({ changed, tests, textOf: (file) => texts[file] ?? "" })

test("the mistake fixtures fire: each test that failed after a builder reported green is selected for its pull request", () => {
  const cases = [
    {
      pr: 1381,
      changed: ["apps/api/drizzle/0022_job_word_pages.sql"],
      missed: "apps/api/src/paper/photo-references.schema.test.ts",
    },
    {
      pr: 1388,
      changed: ["packages/ui/src/components/sonner.test.tsx"],
      missed: "apps/web/src/test/ui-kit-contract.test.ts",
    },
    {
      pr: 1406,
      changed: ["apps/api/src/auth-limits.ts"],
      missed: "apps/api/src/registry/ownership.test.ts",
    },
    {
      pr: 1407,
      changed: ["apps/api/src/paper/commands.ts"],
      missed: "apps/api/src/registry/paper-contract.test.ts",
    },
    {
      pr: 1407,
      changed: ["packages/domain/src/paper-contract.ts"],
      missed:
        "apps/api/src/registry/reads-an-undo-or-approval-can-change.test.ts",
    },
    {
      pr: 1407,
      changed: ["apps/api/src/paper/commands.ts"],
      missed: "apps/api/src/registry/transaction.test.ts",
    },
  ]
  for (const item of cases) {
    const why = picked(select(item.changed, [item.missed]))[item.missed]
    assert.match(String(why), /scans the tree/, `#${item.pr} ${item.missed}`)
  }
})

test("the clean fixture stays quiet: a change reaches no test that neither scans its folder nor imports it", () => {
  const selection = select(
    ["apps/web/src/features/apply/apply-row.tsx", "README.md"],
    [
      "apps/api/src/registry/ownership.test.ts",
      "packages/ui/src/components/button.test.tsx",
      "apps/web/src/features/paper/paper-home.test.tsx",
    ],
    {
      "apps/web/src/features/paper/paper-home.test.tsx":
        'import { x } from "./paper-home"\n',
    }
  )
  assert.deepEqual(selection.groups, [])
})

test("a test is selected when it changed or imports a changed file by relative path, alias or kit path", () => {
  const texts = {
    "apps/web/src/features/paper/a.test.tsx": 'import { a } from "./a.tsx"\n',
    "apps/web/src/features/paper/b.test.tsx":
      'import { b } from "@/lib/contract-client"\n',
    "apps/web/src/features/paper/c.test.tsx":
      'vi.mock("@workspace/ui/components/sonner")\n',
    "scripts/ocv-tools/x.test.mjs": 'import { y } from "./jobs/y.mjs"\n',
  }
  const why = picked(
    select(
      [
        "apps/web/src/features/paper/a.tsx",
        "apps/web/src/lib/contract-client.ts",
        "packages/ui/src/components/sonner.tsx",
        "scripts/ocv-tools/jobs/y.mjs",
        "scripts/ocv-tools/jobs/z.test.mjs",
      ],
      [...Object.keys(texts), "scripts/ocv-tools/jobs/z.test.mjs"],
      texts
    )
  )
  assert.deepEqual(why, {
    "apps/web/src/features/paper/a.test.tsx":
      "imports apps/web/src/features/paper/a.tsx",
    "apps/web/src/features/paper/b.test.tsx":
      "imports apps/web/src/lib/contract-client.ts",
    "apps/web/src/features/paper/c.test.tsx":
      "imports packages/ui/src/components/sonner.tsx",
    "scripts/ocv-tools/x.test.mjs": "imports scripts/ocv-tools/jobs/y.mjs",
    "scripts/ocv-tools/jobs/z.test.mjs": "changed in this branch",
  })
  assert.ok(
    importedStems("apps/api/src/a.test.ts", 'from "../db/schema.js"').has(
      "apps/api/db/schema"
    )
  )
})

test("a file imported by many tests leaves its importers to CI and says so", () => {
  const tests = Array.from(
    { length: HUB_IMPORTERS + 1 },
    (_, i) => `apps/api/src/t${i}.test.ts`
  )
  const texts = Object.fromEntries(
    tests.map((file) => [file, 'import "./db/schema.js"\n'])
  )
  const selection = select(["apps/api/src/db/schema.ts"], tests, texts)
  assert.deepEqual(selection.groups, [])
  assert.deepEqual(selection.hubs, [
    { file: "apps/api/src/db/schema.ts", importers: HUB_IMPORTERS + 1 },
  ])
  const lines = describeSelection({ changed: ["x"], ...selection })
  assert.ok(
    lines.some((line) => /imported by 13 tests; .*CI runs the rest/.test(line))
  )
})

test("a huge selection is capped per runner and the cap is printed", () => {
  const tests = Array.from(
    { length: MAX_PER_RUNNER + 5 },
    (_, i) => `apps/api/src/t${String(i).padStart(3, "0")}.test.ts`
  )
  const selection = select(tests, tests)
  assert.equal(selection.groups[0].files.length, MAX_PER_RUNNER)
  assert.equal(selection.groups[0].dropped.length, 5)
  const lines = describeSelection({ changed: tests, ...selection })
  assert.ok(
    lines.some((line) => /CAPPED apps\/api at 40 files; 5 more/.test(line))
  )
})

test("every test that scans the tree is in TREE_SCANS, and every mapped test exists", () => {
  const listed = execFileSync(
    "git",
    ["ls-files", "-z", "apps/*/src", "packages/*/src"],
    { cwd: root, encoding: "utf8" }
  )
    .split("\0")
    .filter((file) => /\.test\.[cm]?[jt]sx?$/.test(file))
  const scanning = listed.filter((file) =>
    SCANS_THE_TREE.test(readFileSync(join(root, file), "utf8"))
  )
  const missing = scanning.filter((file) => !(file in TREE_SCANS))
  assert.deepEqual(
    missing,
    [],
    `add each to TREE_SCANS in scripts/ocv-tools/jobs/affected-tests.mjs with the folders it reads, so a change there runs it`
  )
  for (const file of Object.keys(TREE_SCANS))
    assert.ok(existsSync(join(root, file)), `${file} is mapped but gone`)
})
