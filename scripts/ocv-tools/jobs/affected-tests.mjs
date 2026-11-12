import { posix } from "node:path"
import { run } from "./common.mjs"

export const MAX_PER_RUNNER = 40
export const HUB_IMPORTERS = 12
const LISTED = 30

const TEST_FILE = /\.(?:test|spec)\.(?:[cm]?[jt]sx?)$/
const NEVER_RUN = /\.type-test\.ts$/
const CODE_EXT = /\.(?:[cm]?[jt]sx?)$/

export const TEST_RUNNERS = Object.freeze([
  {
    name: "apps/api",
    root: "apps/api/src/",
    cmd: "apps/api/node_modules/.bin/vitest",
    args: ["run", "--maxWorkers=2"],
  },
  {
    name: "apps/web",
    root: "apps/web/src/",
    cmd: "apps/web/node_modules/.bin/vitest",
    args: ["run", "--config", "vitest.config.ts", "--maxWorkers=2"],
  },
  {
    name: "packages/ui",
    root: "packages/ui/src/",
    cmd: "packages/ui/node_modules/.bin/vitest",
    args: ["run", "--config", "vitest.config.ts", "--maxWorkers=2"],
  },
  {
    name: "packages/paper-crdt",
    root: "packages/paper-crdt/src/",
    cmd: "packages/paper-crdt/node_modules/.bin/vitest",
    args: ["run", "--maxWorkers=2"],
  },
  {
    name: "packages/domain",
    root: "packages/domain/src/",
    flat: true,
    cmd: "node",
    args: [
      "--experimental-strip-types",
      "--import",
      "./register-ts.mjs",
      "--test",
      "--test-reporter=dot",
    ],
  },
  {
    name: "scripts",
    root: "scripts/",
    dir: "",
    cmd: "node",
    args: ["--test", "--test-reporter=dot"],
  },
])

const api = (path) => new RegExp(`^apps/api/${path}`)
const web = (path) => new RegExp(`^apps/web/${path}`)
const API_SRC = api("src/")
const WEB_SRC = web("src/")
const UI_SRC = /^packages\/ui\/src\//
const DOMAIN_SRC = /^packages\/domain\/src\//
const MIGRATIONS = api("drizzle/")
const COMMAND_FILES =
  /^apps\/api\/src\/(?:.+\/)?commands?\.ts$|^apps\/api\/src\/registry\//
const CONTRACT = [DOMAIN_SRC, COMMAND_FILES]

export const TREE_SCANS = Object.freeze({
  "apps/api/src/auth-routes.test.ts": [WEB_SRC],
  "apps/api/src/db/migrate.test.ts": [MIGRATIONS],
  "apps/api/src/paper/photo-references.schema.test.ts": [
    MIGRATIONS,
    /^apps\/api\/src\/(?:.+\/)?[^/]*schema[^/]*\.ts$/,
  ],
  "apps/api/src/registry/boundaries.test.ts": [API_SRC],
  "apps/api/src/registry/names.test.ts": [WEB_SRC, DOMAIN_SRC, API_SRC],
  "apps/api/src/registry/ownership.test.ts": [API_SRC],
  "apps/api/src/registry/reads-an-undo-or-approval-can-change.test.ts": [
    DOMAIN_SRC,
    API_SRC,
  ],
  "apps/api/src/registry/catalog.test.ts": CONTRACT,
  "apps/api/src/registry/job-contract.test.ts": CONTRACT,
  "apps/api/src/registry/paper-contract.test.ts": CONTRACT,
  "apps/api/src/registry/transaction.test.ts": CONTRACT,
  "apps/web/src/features/coach/coach-primary-action.test.ts": [WEB_SRC],
  "apps/web/src/features/paper/paper-fixtures.test.ts": [
    web("src/features/paper/"),
  ],
  "apps/web/src/features/paper/paper-print.test.ts": [
    web("src/features/paper/"),
  ],
  "apps/web/src/features/seed/sample-author.test.ts": [WEB_SRC],
  "apps/web/src/test/deploy-config.test.ts": [
    /^\.railway\//,
    /^\.env\.example$/,
    /^apps\/[^/]+\/(?:package\.json|vite\.config\.ts|Dockerfile)$/,
  ],
  "apps/web/src/test/design-vocabulary.test.ts": [WEB_SRC, UI_SRC],
  "apps/web/src/test/disclosure-buttons.test.ts": [WEB_SRC],
  "apps/web/src/test/feature-imports.test.ts": [WEB_SRC],
  "apps/web/src/test/landing-art-rotation.test.ts": [
    web("src/features/landing/"),
  ],
  "apps/web/src/test/landing-button.test.ts": [web("src/features/landing/")],
  "apps/web/src/test/module-isolation.test.ts": [
    WEB_SRC,
    web("vitest\\.config\\.ts$"),
  ],
  "apps/web/src/test/no-use-state.test.ts": [WEB_SRC],
  "apps/web/src/test/page-header-guard.test.ts": [WEB_SRC],
  "apps/web/src/test/rejected-command.test.ts": [WEB_SRC],
  "apps/web/src/test/request-boundary.test.ts": [WEB_SRC],
  "apps/web/src/test/ui-kit-contract.test.ts": [UI_SRC, WEB_SRC],
  "apps/web/src/test/ui-kit-styled.test.ts": [UI_SRC],
  "apps/web/src/test/warm-routes.test.ts": [WEB_SRC],
  "scripts/ocv-tools/brief.test.mjs": [
    /^AGENTS\.md$/,
    /^docs\/agents\/brief-fences\.json$/,
  ],
  "scripts/ocv-tools/rules-doc.test.mjs": [
    /^AGENTS\.md$/,
    /^scripts\/ocv-tools\/rules\//,
  ],
})

export const SCANS_THE_TREE = /readdirSync|globSync|import\.meta\.glob/

export function runnerOf(file) {
  for (const runner of TEST_RUNNERS) {
    if (!file.startsWith(runner.root)) continue
    if (runner.flat && file.slice(runner.root.length).includes("/")) continue
    return runner
  }
  return null
}

export function isRunnableTest(file) {
  return TEST_FILE.test(file) && !NEVER_RUN.test(file) && !!runnerOf(file)
}

const SPECIFIER =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\bvi\.mock\(\s*)["']([^"']+)["']/g

const PACKAGE_SOURCE = [
  [/^@workspace\/ui\/(components|lib|hooks)\/(.+)$/, "packages/ui/src/$1/$2"],
  [/^@workspace\/domain$/, "packages/domain/src/index"],
  [/^@workspace\/paper-crdt$/, "packages/paper-crdt/src/index"],
]

export function importedStems(file, text) {
  const stems = new Set()
  for (const match of String(text).matchAll(SPECIFIER)) {
    const spec = match[1]
    let target = null
    if (spec.startsWith(".")) target = posix.join(posix.dirname(file), spec)
    else if (spec.startsWith("@/") && file.startsWith("apps/web/"))
      target = `apps/web/src/${spec.slice(2)}`
    else
      for (const [pattern, to] of PACKAGE_SOURCE)
        if (pattern.test(spec)) target = spec.replace(pattern, to)
    if (!target) continue
    const stem = target.replace(CODE_EXT, "")
    stems.add(stem)
    stems.add(`${stem}/index`)
  }
  return stems
}

function scanReason(test, changed) {
  const patterns = TREE_SCANS[test]
  if (!patterns) return null
  const hit = changed.find((file) => patterns.some((p) => p.test(file)))
  return hit ? `scans the tree that holds ${hit}` : null
}

export function selectTests({ changed, tests, textOf }) {
  const changedSet = new Set(changed)
  const stems = new Map(
    changed
      .filter((file) => CODE_EXT.test(file))
      .map((file) => [file.replace(CODE_EXT, ""), file])
  )
  const runnable = tests.filter(isRunnableTest)
  const importers = new Map()
  for (const test of runnable) {
    for (const stem of importedStems(test, textOf(test))) {
      const hit = stems.get(stem)
      if (!hit || hit === test) continue
      importers.set(hit, [...(importers.get(hit) ?? []), test])
    }
  }
  const hubs = [...importers]
    .filter(([, list]) => list.length > HUB_IMPORTERS)
    .map(([file, list]) => ({ file, importers: list.length }))
  const hubFiles = new Set(hubs.map((hub) => hub.file))
  const picked = []
  for (const test of runnable) {
    let why = changedSet.has(test) ? "changed in this branch" : null
    let rank = 0
    if (!why) {
      why = scanReason(test, changed)
      rank = 1
    }
    if (!why) {
      const hit = [...importers].find(
        ([file, list]) => !hubFiles.has(file) && list.includes(test)
      )
      why = hit ? `imports ${hit[0]}` : null
      rank = 2
    }
    if (why) picked.push({ file: test, why, rank })
  }
  const groups = []
  for (const runner of TEST_RUNNERS) {
    const own = picked
      .filter((item) => runnerOf(item.file) === runner)
      .sort((a, b) => a.rank - b.rank || a.file.localeCompare(b.file))
    if (!own.length) continue
    groups.push({
      runner: runner.name,
      files: own.slice(0, MAX_PER_RUNNER),
      dropped: own.slice(MAX_PER_RUNNER),
    })
  }
  return { groups, hubs }
}

const split = (out) => out.split("\0").filter(Boolean)

export function readBlobs(ctx, top, rev, paths) {
  if (!paths.length) return new Map()
  const r = run(ctx, "git", ["cat-file", "--batch"], {
    cwd: top,
    raw: true,
    input: paths.map((path) => `${rev}:${path}\n`).join(""),
  })
  const bytes = Buffer.from(r.out ?? "", "utf8")
  const texts = new Map()
  let at = 0
  for (const path of paths) {
    const end = bytes.indexOf(10, at)
    if (end < 0) break
    const header = bytes.subarray(at, end).toString("utf8").split(" ")
    at = end + 1
    if (header[1] !== "blob") continue
    const size = Number(header[2])
    texts.set(path, bytes.subarray(at, at + size).toString("utf8"))
    at += size + 1
  }
  return texts
}

export function branchSelection(ctx, top, { base, head }) {
  const fork = run(ctx, "git", ["merge-base", base, head], { cwd: top })
  if (!fork.ok) return null
  const changed = split(
    run(
      ctx,
      "git",
      [
        "diff",
        "--name-only",
        "--no-renames",
        "--diff-filter=ACMRD",
        "-z",
        fork.out,
        head,
      ],
      { cwd: top, raw: true }
    ).out
  )
  const tests = split(
    run(
      ctx,
      "git",
      [
        "ls-tree",
        "-r",
        "-z",
        "--name-only",
        head,
        "--",
        "apps",
        "packages",
        "scripts",
      ],
      { cwd: top, raw: true }
    ).out
  ).filter(isRunnableTest)
  const texts = readBlobs(ctx, top, head, tests)
  return {
    changed,
    ...selectTests({
      changed,
      tests,
      textOf: (file) => texts.get(file) ?? "",
    }),
  }
}

export function describeSelection(selection) {
  const lines = []
  const total = selection.groups.reduce((n, g) => n + g.files.length, 0)
  const dropped = selection.groups.reduce((n, g) => n + g.dropped.length, 0)
  lines.push(
    `affected tests: ${total} test file(s) selected for ${selection.changed.length} changed file(s): changed tests, tests that scan a changed folder, and tests that import a changed file.`
  )
  const all = selection.groups.flatMap((g) => g.files)
  for (const item of all.slice(0, LISTED))
    lines.push(`  ${item.file}  (${item.why})`)
  if (all.length > LISTED) lines.push(`  ... and ${all.length - LISTED} more`)
  for (const group of selection.groups.filter((g) => g.dropped.length))
    lines.push(
      `affected tests: CAPPED ${group.runner} at ${MAX_PER_RUNNER} files; ${group.dropped.length} more were selected and not run here (CI runs the whole suite).`
    )
  for (const hub of selection.hubs ?? [])
    lines.push(
      `affected tests: ${hub.file} is imported by ${hub.importers} tests; only its scan and changed tests run here, CI runs the rest.`
    )
  if (dropped === 0 && total > 0)
    lines.push(
      "affected tests: tests reached only through deeper imports run in CI, not here."
    )
  return lines
}

export function affectedPlan(selection, top) {
  return selection.groups.map((group) => {
    const runner = TEST_RUNNERS.find((r) => r.name === group.runner)
    const dir = runner.dir ?? runner.name
    const cwd = dir ? `${top}/${dir}` : top
    const files = group.files.map((item) =>
      dir ? item.file.slice(dir.length + 1) : item.file
    )
    return {
      label: `tests ${group.runner}`,
      cmd: runner.cmd === "node" ? "node" : `${top}/${runner.cmd}`,
      args: [...runner.args, ...files],
      cwd,
      needsInstall: runner.cmd !== "node",
    }
  })
}

export const receiptPath = (gitDir, head) =>
  `${gitDir}/ocv-tools-affected-tests-${head}`

export function hasReceipt(ctx, gitDir, head) {
  return Boolean(head) && ctx.ports.fs.exists(receiptPath(gitDir, head))
}

export function runAffected(ctx, top, head) {
  const selection = branchSelection(ctx, top, { base: "origin/main", head })
  if (!selection)
    return {
      failed: [],
      recorded: false,
      lines: [
        "affected tests: origin/main is missing, so the affected tests were not selected; run git fetch origin main.",
      ],
    }
  const lines = describeSelection(selection)
  const failed = []
  for (const step of affectedPlan(selection, top)) {
    if (step.needsInstall && !ctx.ports.fs.exists(step.cmd)) {
      failed.push(
        `${step.label} (vitest is not installed here; run pnpm install in this worktree)`
      )
      continue
    }
    const r = run(ctx, step.cmd, step.args, { cwd: step.cwd, inherit: true })
    if (!r.ok) failed.push(step.label)
  }
  const gitDir = run(ctx, "git", ["rev-parse", "--absolute-git-dir"], {
    cwd: top,
  }).out
  const dirty = run(
    ctx,
    "git",
    ["status", "--porcelain", "--untracked-files=no"],
    { cwd: top }
  ).out
  const recorded = !failed.length && !dirty && Boolean(gitDir)
  if (recorded)
    ctx.writeFile(
      receiptPath(gitDir, head),
      `${JSON.stringify({ head, files: selection.groups.flatMap((g) => g.files.map((f) => f.file)) })}\n`
    )
  if (!failed.length && dirty)
    lines.push(
      "affected tests: passed, but the worktree has unsaved edits, so no receipt was recorded for this commit."
    )
  return { failed, recorded, lines }
}

export function testsForPush(ctx, top, shas) {
  const head = run(ctx, "git", ["rev-parse", "HEAD"], { cwd: top }).out
  if (!shas.includes(head))
    return {
      failed: [],
      lines: [
        "affected tests: not run, because the pushed commit is not the checked-out HEAD.",
      ],
    }
  const gitDir = run(ctx, "git", ["rev-parse", "--absolute-git-dir"], {
    cwd: top,
  }).out
  if (hasReceipt(ctx, gitDir, head))
    return {
      failed: [],
      lines: [
        `affected tests: already passed at ${head.slice(0, 12)}, not run again.`,
      ],
    }
  return runAffected(ctx, top, head)
}

export function checkJob(ctx, flags) {
  const top = run(ctx, "git", ["rev-parse", "--show-toplevel"]).out || ctx.cwd
  if (flags["--list"]) {
    const selection = branchSelection(ctx, top, {
      base: flags["--base"] ?? "origin/main",
      head: flags["--head"] ?? "HEAD",
    })
    if (!selection)
      throw new Error(
        "check --list could not find the fork point; run git fetch origin main"
      )
    return {
      lines: describeSelection(selection),
      next: "scripts/ocv-tools.mjs check",
    }
  }
  const head = run(ctx, "git", ["rev-parse", "HEAD"], { cwd: top }).out
  return { head, ...runAffected(ctx, top, head) }
}
