import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { affectedPlan, passLines, selectAndAccount } from "./affected-tests.mjs"
import { realWorkspace, workspaceInput } from "./hook-world.mjs"
import { importGraph } from "./import-graph.mjs"
import { proofCommand } from "./test-accounting.mjs"
import {
  LISTS_FILES,
  MAX_PER_RUNNER,
  TREE_SCANS,
  scannerMap,
} from "./test-selection.mjs"

const root = fileURLToPath(new URL("../../../", import.meta.url))
const workspace = workspaceInput()
const picked = (selection) =>
  Object.fromEntries(
    selection.groups.flatMap((group) =>
      group.files.map((item) => [item.file, item.why])
    )
  )

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

test("no selection path runs a whole suite without --all: configs, setup, package files, drizzle config, assets, hooks, tool files and over-cap changes are broad and name what CI runs", () => {
  const many = Array.from(
    { length: MAX_PER_RUNNER + 5 },
    (_, i) => `apps/api/src/t${String(i).padStart(3, "0")}.test.ts`
  )
  const cases = [
    ["apps/web/vitest.config.ts"],
    ["apps/web/src/test/setup.ts"],
    ["apps/api/src/test/global-setup.ts"],
    ["apps/web/package.json"],
    ["package.json", "pnpm-lock.yaml"],
    ["apps/api/drizzle.config.ts"],
    ["apps/web/public/apple-touch-icon.png"],
    [".githooks/pre-push"],
    ["scripts/ocv-tools/jobs/hook.mjs"],
    ["packages/guards/run-tests.mjs"],
    ["tsconfig.json"],
    ["apps/web/eslint.config.js"],
    ["tools/x.ts"],
    ["README.md"],
    many,
  ]
  const texts = {
    "apps/web/vitest.config.ts":
      'export default { test: { setupFiles: ["./src/test/setup.ts"] } }\n',
    "apps/api/vitest.config.ts":
      'export default { test: { globalSetup: ["./src/test/global-setup.ts"] } }\n',
  }
  const WHOLE = /--filter|guards|scripts\/ocv-tools\/\*\*|run (typecheck|lint)/
  for (const changed of cases) {
    const tests = [...changed, ...Object.keys(texts)]
    const plain = selectAndAccount({
      changed,
      tests,
      textOf: (file) => texts[file] ?? "",
      workspace,
    })
    assert.deepEqual(plain.accounting.proofs, [], changed[0])
    const steps = affectedPlan(plain, "/repo", { proofs: true })
    assert.ok(
      !steps.some((step) => WHOLE.test([step.cmd, ...step.args].join(" "))),
      `${changed[0]} runs a whole suite without --all`
    )
    const asked = selectAndAccount({
      changed,
      tests,
      textOf: (file) => texts[file] ?? "",
      workspace,
      all: true,
    })
    assert.ok(
      asked.accounting.proofs.length > 0,
      `${changed[0]} names no larger run under --all`
    )
    assert.deepEqual(
      plain.accounting.deferred,
      asked.accounting.proofs.map(proofCommand),
      changed[0]
    )
  }
})

test("every test that lists files, by git ls-files, readdir, glob or import.meta.glob in its own code or a helper it imports, has a scanner mapping", () => {
  const { paths, texts } = realRepository()
  const textOf = (file) => texts.get(file) ?? ""
  const tests = paths.filter((file) =>
    /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file)
  )
  const { importersOf } = importGraph(paths, textOf)
  const map = scannerMap({ paths, runnable: tests, textOf, importersOf })
  const imports = new Map()
  for (const [target, by] of importersOf)
    if (!/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(target))
      for (const file of by)
        imports.set(file, [...(imports.get(file) ?? []), target])
  const listing = tests.filter((test) =>
    [test, ...(imports.get(test) ?? [])].some((file) =>
      LISTS_FILES.test(textOf(file))
    )
  )
  assert.ok(listing.length > 80, `only ${listing.length} listing tests found`)
  for (const kind of ["ls-files", "readdirSync"])
    assert.ok(
      listing.some((test) => textOf(test).includes(kind)),
      kind
    )
  const missing = listing.filter((test) => !map.has(test))
  assert.deepEqual(
    missing,
    [],
    "map each in TREE_SCANS (scripts/ocv-tools/jobs/test-selection.mjs), or name the folders it lists in its code"
  )
  for (const scan of map.values())
    assert.ok(scan.patterns.length || scan.dirs.length)
  for (const file of Object.keys(TREE_SCANS))
    assert.ok(existsSync(join(root, file)), `${file} is mapped but gone`)
})

test("a change under what a listing scanner reads selects it: touch targets, useState and the scripts scanners that use git ls-files", () => {
  const { paths, texts } = realRepository()
  const feature = "apps/web/src/features/apply/apply-board-empty.tsx"
  const workspaceFiles = {
    workspaceYaml: readFileSync(join(root, "pnpm-workspace.yaml"), "utf8"),
    packageJsons: new Map(
      paths
        .filter((path) => /(?:^|\/)package\.json$/.test(path))
        .map((path) => [path, readFileSync(join(root, path), "utf8")])
    ),
  }
  const cases = [
    [feature, "scripts/touch-targets.test.mjs"],
    [feature, "apps/web/src/test/no-use-state.test.ts"],
    ["apps/web/src/lib/x.ts", "scripts/pointer-capture.test.mjs"],
    ["packages/ui/src/components/x.tsx", "scripts/pointer-capture.test.mjs"],
    ["apps/web/src/lib/x.ts", "scripts/word-classification.test.mjs"],
    ["apps/web/src/lib/x.ts", "scripts/root-redirect-warmup.test.mjs"],
    ["apps/web/src/lib/x.ts", "scripts/session-check-reads.test.mjs"],
    [
      "apps/web/src/features/paper/x.ts",
      "scripts/paper-save-keeps-parts.test.mjs",
    ],
    ["apps/api/src/x.ts", "scripts/catalog-adapters.test.mjs"],
    ["apps/api/src/x.ts", "scripts/parser-off-request-thread.test.mjs"],
    ["packages/ui/src/components/x.tsx", "scripts/retired-words.test.mjs"],
    ["packages/ui/src/components/x.tsx", "scripts/kit-duplicates.test.mjs"],
    ["apps/web/src/lib/x.ts", "scripts/page-probes.test.mjs"],
  ]
  const added =
    'import { useState } from "react"\nexport const E = () => <button className="flex h-7 hover:bg-sidebar-accent" />\n'
  for (const [changed, scanner] of cases) {
    const selection = selectAndAccount({
      changed: [changed],
      tests: [...paths, changed],
      textOf: (file) => (file === changed ? added : (texts.get(file) ?? "")),
      workspace: workspaceFiles,
    })
    assert.match(
      String(picked(selection)[scanner]),
      /scans the tree that holds/,
      `${changed} does not select ${scanner}`
    )
  }
})

test("adding scripts/new.test.mjs selects the scanner of its own scripts folder", () => {
  const { paths, texts } = realRepository()
  const changed = "scripts/new.test.mjs"
  const selection = selectAndAccount({
    changed: [changed],
    tests: [...paths, changed],
    textOf: (file) => texts.get(file) ?? "",
    workspace,
  })
  assert.match(
    String(picked(selection)["scripts/unbounded-spawn.test.mjs"]),
    /scans the tree that holds scripts\/new\.test\.mjs/
  )
})

test("scanner roots retain own and ancestor folders while explicit mappings exclude incidental folder names", () => {
  const own = "scripts/tools/own.test.mjs"
  const helper = "scripts/tools/list.mjs"
  const inherited = "scripts/tools/helper.test.mjs"
  const explicit = "scripts/ocv-tools/brief.test.mjs"
  const incidental = "scripts/unknown.test.mjs"
  const texts = {
    [own]: 'readdirSync("scripts/tools")',
    [helper]: 'execFileSync("git", ["ls-files", "scripts"])',
    [explicit]: 'const cwd = "scripts"; readdirSync("docs")',
    [incidental]: 'const cwd = "scripts"; readdirSync(target)',
  }
  const map = scannerMap({
    paths: [
      own,
      helper,
      inherited,
      explicit,
      incidental,
      "docs/agents/brief-fences.json",
    ],
    runnable: [own, inherited, explicit, incidental],
    textOf: (file) => texts[file] ?? "",
    importersOf: new Map([[helper, [inherited]]]),
  })
  assert.ok(map.get(own).dirs.includes("scripts/tools"))
  assert.ok(map.get(inherited).dirs.includes("scripts"))
  assert.deepEqual(map.get(explicit).dirs, [])
  assert.equal(map.get(explicit).how, "table")
  assert.ok(map.get(incidental).dirs.includes(""))
})

test("a package whose suite runs its files from the repository root (the guards suite) has its selected files run from the root too", () => {
  const file = "packages/guards/test-completeness.test.mjs"
  const selection = selectAndAccount({
    changed: [file],
    tests: [file],
    textOf: () => "",
    workspace: workspaceInput(realWorkspace()),
  })
  const [step] = affectedPlan(selection, "/repo")
  assert.equal(step.cwd, "/repo")
  assert.ok(step.args.includes(file), step.args.join(" "))
})

test("on the real tree a drizzle config, a public asset and a file outside every package are broad, name what CI runs, and never read as a full pass", () => {
  const { paths, texts } = realRepository()
  const workspaceFiles = {
    workspaceYaml: readFileSync(join(root, "pnpm-workspace.yaml"), "utf8"),
    packageJsons: new Map(
      paths
        .filter((path) => /(?:^|\/)package\.json$/.test(path))
        .map((path) => [path, readFileSync(join(root, path), "utf8")])
    ),
  }
  for (const [changed, ci] of [
    ["apps/api/drizzle.config.ts", "pnpm --filter api test"],
    ["apps/web/public/apple-touch-icon.png", "pnpm --filter web test"],
    ["tools/x.ts", "pnpm --filter @workspace/guards test"],
  ]) {
    const selection = selectAndAccount({
      changed: [changed],
      tests: [...paths, changed],
      textOf: (file) => texts.get(file) ?? "",
      workspace: workspaceFiles,
    })
    const entry = selection.accounting.entries[0]
    assert.equal(entry.rule, "broad", `${changed}: ${entry.says}`)
    assert.ok(selection.accounting.deferred.includes(ci), changed)
    assert.deepEqual(selection.accounting.proofs, [])
    const [headline, ...rest] = passLines({
      partial: selection.partial,
      deferred: selection.accounting.deferred,
      ran: selection.accounting.ran,
    })
    assert.match(headline, /passed for the part of this change it ran/)
    assert.ok(
      rest.some((line) => line.includes(ci)),
      changed
    )
  }
})
