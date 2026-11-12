import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { describeSelection, selectAndAccount } from "./affected-tests.mjs"
import { UnreadableGitOutput } from "./git-reads.mjs"
import { workspaceInput } from "./hook-world.mjs"
import { importedStems } from "./import-graph.mjs"
import {
  LOCAL_CAP,
  MAX_PER_RUNNER,
  SCANS_THE_TREE,
  TREE_SCANS,
} from "./test-selection.mjs"
import { focusedCalls, runnerFor } from "./test-runners.mjs"

const root = fileURLToPath(new URL("../../../", import.meta.url))
const picked = (selection) =>
  Object.fromEntries(
    selection.groups.flatMap((group) =>
      group.files.map((item) => [item.file, item.why])
    )
  )
const workspace = workspaceInput()
const select = (changed, tests, texts = {}) =>
  selectAndAccount({
    changed,
    tests,
    textOf: (file) => texts[file] ?? "",
    workspace,
  })

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

const entryOf = (selection, file) =>
  selection.accounting.entries.find((entry) => entry.file === file)

const ranHere = (selection, failing) =>
  Object.keys(picked(selection)).includes(failing)

test("B1: a hub's importers are not dropped; past the cap the pass is partial and names what CI runs, and --all asks for the whole suite", () => {
  const tests = Array.from(
    { length: 23 },
    (_, i) => `scripts/t${String(i).padStart(2, "0")}.test.mjs`
  )
  const texts = Object.fromEntries(
    tests.map((file) => [
      file,
      'import { tempDir } from "./lib/temp-dir.mjs"\n',
    ])
  )
  const small = select(["scripts/lib/temp-dir.mjs"], tests, texts)
  assert.deepEqual(Object.keys(picked(small)).sort(), tests)
  assert.equal(entryOf(small, "scripts/lib/temp-dir.mjs").rule, "tests")
  assert.deepEqual(small.partial, [])
  const many = Array.from(
    { length: MAX_PER_RUNNER + 3 },
    (_, i) => `apps/api/src/t${String(i).padStart(2, "0")}.test.ts`
  )
  const manyTexts = Object.fromEntries(
    many.map((file) => [file, 'import "./db/schema.js"\n'])
  )
  const big = select(["apps/api/src/db/schema.ts"], many, manyTexts)
  const entry = entryOf(big, "apps/api/src/db/schema.ts")
  assert.equal(entry.rule, "partial")
  assert.match(
    entry.says,
    /25 of the 43 test file\(s\) that reach it ran here; CI runs the rest/
  )
  assert.deepEqual(big.accounting.proofs, [])
  assert.equal(
    picked(big)["apps/api/src/t00.test.ts"],
    "imports apps/api/src/db/schema.ts"
  )
  assert.equal(Object.keys(picked(big)).length, LOCAL_CAP)
  assert.deepEqual(big.partial, [
    {
      runner: "apps/api",
      pkg: "api",
      ran: 25,
      reached: 43,
      leftOut: [
        "apps/api/src/t25.test.ts",
        "apps/api/src/t26.test.ts",
        "apps/api/src/t27.test.ts",
      ],
    },
  ])
  assert.ok(
    describeSelection(big).includes(
      "Local pre-check ran 25 of 43 tests this change reaches in apps/api; CI runs the rest (first left out: apps/api/src/t25.test.ts, apps/api/src/t26.test.ts, apps/api/src/t27.test.ts)."
    )
  )
  const all = selectAndAccount({
    changed: ["apps/api/src/db/schema.ts"],
    tests: many,
    textOf: (file) => manyTexts[file] ?? "",
    workspace,
    all: true,
  })
  assert.equal(entryOf(all, "apps/api/src/db/schema.ts").rule, "unknown")
  assert.deepEqual(
    all.accounting.proofs.map((proof) => proof.args.join(" ")),
    ["--filter api test"]
  )
})

test("over the cap, changed tests and folder scanners always run, then the nearest importers fill the local cap, and deeper tests are left to CI", () => {
  const scanner = "apps/api/src/registry/boundaries.test.ts"
  const changedTest = "apps/api/src/x/own.test.ts"
  const direct = Array.from(
    { length: 30 },
    (_, i) => `apps/api/src/d/d${String(i).padStart(2, "0")}.test.ts`
  )
  const deep = Array.from(
    { length: 20 },
    (_, i) => `apps/api/src/e/e${String(i).padStart(2, "0")}.test.ts`
  )
  const texts = {
    ...Object.fromEntries(direct.map((f) => [f, 'import "../x/hub.js"\n'])),
    ...Object.fromEntries(deep.map((f) => [f, 'import "../x/mid.js"\n'])),
    "apps/api/src/x/mid.ts": 'import "./hub.js"\n',
    [changedTest]: "test()\n",
  }
  const selection = select(
    ["apps/api/src/x/hub.ts", changedTest],
    [...Object.keys(texts), scanner, "apps/api/src/x/hub.ts"],
    texts
  )
  const ran = Object.keys(picked(selection))
  assert.equal(ran.length, LOCAL_CAP)
  assert.ok(ran.includes(scanner) && ran.includes(changedTest))
  assert.deepEqual(
    ran.filter((f) => f.includes("/d/")),
    direct.slice(0, LOCAL_CAP - 2)
  )
  assert.ok(!ran.some((f) => f.includes("/e/")))
  assert.equal(entryOf(selection, changedTest).rule, "tests")
  assert.equal(entryOf(selection, "apps/api/src/x/hub.ts").rule, "partial")
})

test("B1: a test that reaches a changed file through other files is selected, across workspaces and through text reads", () => {
  const texts = {
    "apps/web/src/features/apply/apply-job-detail.test.tsx":
      'import { renderApp } from "@/test/render-app"\n',
    "apps/web/src/test/render-app.tsx":
      'import { ApplyJobDetail } from "@/features/apply/apply-job-detail"\n',
    "apps/web/src/features/apply/apply-job-detail.tsx":
      'import { DeleteDialog } from "./apply-job-delete-dialog"\n',
    "apps/web/src/features/apply/apply-job-delete-dialog.tsx":
      'import { paperRead } from "@workspace/domain"\n',
    "packages/domain/src/index.ts": 'export * from "./paper-contract"\n',
    "apps/web/src/features/app-shell/shell-chrome.test.ts":
      'const SHELL_FILES = ["app-shell.tsx"]\nreadFileSync(path.join(here, file), "utf8")\n',
    "scripts/check.test.mjs":
      'execFileSync("node", [join(root, "scripts/check.mjs")])\n',
  }
  const tests = [
    ...Object.keys(texts),
    "packages/domain/src/paper-contract.ts",
    "apps/web/src/features/app-shell/app-shell.tsx",
    "scripts/check.mjs",
  ]
  const why = picked(
    select(
      [
        "apps/web/src/features/apply/apply-job-delete-dialog.tsx",
        "packages/domain/src/paper-contract.ts",
        "apps/web/src/features/app-shell/app-shell.tsx",
        "scripts/check.mjs",
      ],
      tests,
      texts
    )
  )
  assert.match(
    why["apps/web/src/features/apply/apply-job-detail.test.tsx"],
    /through other files/
  )
  assert.equal(
    why["apps/web/src/features/app-shell/shell-chrome.test.ts"],
    "imports apps/web/src/features/app-shell/app-shell.tsx"
  )
  assert.equal(why["scripts/check.test.mjs"], "imports scripts/check.mjs")
})

test("B1: a file a vitest config reads directly (setup, global setup) needs the whole package suite; a file deeper than that is a reached file, not a config", () => {
  const texts = {
    "apps/web/vitest.config.ts":
      'export default { test: { setupFiles: ["./src/test/setup.ts"] } }\n',
    "apps/web/src/test/setup.ts": 'import "./mock-server"\n',
  }
  const deeper = select(
    ["apps/web/src/test/mock-server.ts"],
    [...Object.keys(texts), "apps/web/src/test/mock-server.ts"],
    texts
  )
  assert.notEqual(
    entryOf(deeper, "apps/web/src/test/mock-server.ts").rule,
    "config"
  )

  const selection = select(
    ["apps/web/src/test/setup.ts"],
    [...Object.keys(texts), "apps/web/src/test/mock-server.ts"],
    texts
  )
  const entry = entryOf(selection, "apps/web/src/test/setup.ts")
  assert.equal(entry.rule, "config")
  assert.match(entry.says, /apps\/web\/vitest\.config\.ts reads it/)
  assert.deepEqual(
    selection.accounting.proofs.map((proof) => proof.args.join(" ")),
    ["--filter web test"]
  )
})

test("B1: a config that lists a test file by name does not make that test's imports need the whole suite, and a helper's prose path is not a read", () => {
  const texts = {
    "apps/web/vitest.config.ts":
      'const ISOLATED = ["src/lib/x.test.ts"]\nimport { hint } from "../../scripts/lib/hints.mjs"\n',
    "apps/web/src/lib/x.test.ts": 'import { x } from "./x"\n',
    "apps/web/src/lib/x.ts": "export const x = 1\n",
    "scripts/lib/hints.mjs": 'export const hint = "AGENTS.md"\n',
  }
  const selection = select(
    ["apps/web/src/lib/x.ts", "AGENTS.md"],
    [...Object.keys(texts), "AGENTS.md"],
    texts
  )
  assert.equal(entryOf(selection, "apps/web/src/lib/x.ts").rule, "tests")
  assert.notEqual(entryOf(selection, "AGENTS.md").rule, "config")
  assert.ok(
    !selection.accounting.proofs.some((proof) => proof.args.includes("web"))
  )
})

function realRepository() {
  const paths = execFileSync(
    "git",
    ["ls-files", "-z", "apps", "packages", "scripts"],
    {
      cwd: root,
      encoding: "utf8",
    }
  )
    .split("\0")
    .filter(Boolean)
  const texts = new Map()
  for (const path of paths)
    if (/\.(?:[cm]?[jt]sx?)$/.test(path) && existsSync(join(root, path)))
      texts.set(path, readFileSync(join(root, path), "utf8"))
  return { paths, texts }
}

test("B1 real history: each test that went red in CI this week runs in the local set", () => {
  const { paths, texts } = realRepository()
  const added = {
    "apps/web/src/routes/paper-doc-open.test.tsx":
      'import { PaperDoc } from "./paper-doc"\n',
    "apps/api/src/account/export-gate.test.ts":
      'import { exportGate } from "./export-gate"\n',
    "apps/api/src/account/export-gate.ts": "export const exportGate = 1\n",
  }
  const commands = "apps/api/src/paper/commands.ts"
  const changedAt =
    texts
      .get(commands)
      .split("\n")
      .findIndex((line) =>
        /missingDocument\(error\)\) throw error/.test(line)
      ) + 1
  assert.ok(changedAt > 0, "the paper.get fallback PR 1441 changed is gone")
  const paperGet = new Map([[commands, [changedAt, changedAt + 3]]])
  const cases = [
    {
      pr: 1441,
      changed: "apps/web/src/features/app-shell/app-shell.tsx",
      failing: "apps/web/src/features/app-shell/shell-chrome.test.ts",
    },
    {
      pr: 1441,
      changed: "apps/web/src/routes/paper-doc-open.test.tsx",
      failing: "apps/web/src/test/module-isolation.test.ts",
    },
    {
      pr: 1441,
      changed: "apps/api/src/paper/commands.ts",
      lines: paperGet,
      failing: "apps/api/src/coach/package-grounding.test.ts",
    },
    {
      pr: 1441,
      changed: "apps/api/src/paper/commands.ts",
      lines: paperGet,
      failing: "apps/api/src/paper/package-proposal.test.ts",
    },
    {
      pr: 1439,
      changed: "apps/api/src/account/export-gate.test.ts",
      failing: "apps/api/src/registry/boundaries.test.ts",
    },
  ]
  const workspaceFiles = {
    workspaceYaml:
      texts.get("pnpm-workspace.yaml") ??
      readFileSync(join(root, "pnpm-workspace.yaml"), "utf8"),
    packageJsons: new Map(
      paths
        .filter((path) => /(?:^|\/)package\.json$/.test(path))
        .map((path) => [path, readFileSync(join(root, path), "utf8")])
    ),
  }
  for (const item of cases) {
    const selection = selectAndAccount({
      changedLines: item.lines ?? new Map(),
      changed: [item.changed],
      tests: [...paths, ...Object.keys(added)],
      textOf: (file) => added[file] ?? texts.get(file) ?? "",
      workspace: workspaceFiles,
    })
    assert.ok(
      ranHere(selection, item.failing),
      `#${item.pr}: ${item.changed} does not run ${item.failing} locally`
    )
  }
})

test("B3: a changed test with .only refuses, by its calls and not by text in comments or strings", () => {
  const file = "packages/ui/src/components/collapsible.test.tsx"
  const real = readFileSync(join(root, file), "utf8")
  const probe = `${real}\ntest.only("review probe only", () => {})\ntest("review probe broken", () => { throw new Error("review probe") })\n`
  assert.throws(
    () => select([file], [file], { [file]: probe }),
    (error) =>
      error instanceof UnreadableGitOutput &&
      /collapsible\.test\.tsx calls test\.only at line \d+/.test(error.message)
  )
  for (const focused of [
    'it.only("a", () => {})',
    'describe.only.each([1])("a", () => {})',
    'test.concurrent.only("a", () => {})',
    'describe.skip.only("a", () => {})',
  ])
    assert.equal(focusedCalls("a.test.ts", focused).length, 1, focused)
  const quiet = [
    '// it.only("a")',
    '/* test.only("b") */',
    'const a = "describe.only(1)"',
    "const b = `it.only`",
    "options.only = true",
    'it("only this", () => {})',
  ].join("\n")
  assert.deepEqual(focusedCalls("a.test.ts", quiet), [])
  assert.doesNotThrow(() =>
    select([file], [file], { [file]: `${real}\n${quiet}\n` })
  )
})

test("B3: every vitest run refuses .only, as CI's vitest does", () => {
  assert.ok(
    runnerFor("packages/ui", "vitest run").args.includes("--allowOnly=false")
  )
})

test("B3 guard: no test file in the repository holds a .only call", () => {
  const listed = execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .filter((file) => /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file))
    .filter((file) => existsSync(join(root, file)))
  const focused = listed.flatMap((file) =>
    focusedCalls(file, readFileSync(join(root, file), "utf8")).map(
      (hit) => `${file}:${hit.line} ${hit.call}`
    )
  )
  assert.deepEqual(focused, [], "remove each .only before committing")
})

test("a huge selection is capped per runner and the cap is printed", () => {
  const tests = Array.from(
    { length: MAX_PER_RUNNER + 5 },
    (_, i) => `apps/api/src/t${String(i).padStart(3, "0")}.test.ts`
  )
  const selection = select(tests, tests)
  assert.equal(selection.groups[0].files.length, MAX_PER_RUNNER)
  assert.equal(selection.groups[0].dropped.length, 5)
  const lines = describeSelection(selection)
  assert.ok(
    lines.some((line) =>
      /over 40 in apps\/api, so only changed tests, folder scanners and the 25 nearest run here; 5 more are left to CI/.test(
        line
      )
    )
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
