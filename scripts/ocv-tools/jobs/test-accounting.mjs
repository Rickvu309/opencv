import {
  SCRIPTS_RUNNER,
  isTestFile,
  packageOf,
  runnerOf,
} from "./test-runners.mjs"

const LISTED_FILES = 60

export const PROOFS = Object.freeze({
  guards: {
    id: "guards",
    cmd: "pnpm",
    args: ["--filter", "@workspace/guards", "test"],
    cost: "the guards suite: every *.test.mjs in the repository, about 160 files, the heaviest local run",
  },
  tools: {
    id: "tools",
    cmd: "node",
    args: ["--test", "--test-reporter=dot", "scripts/ocv-tools/**/*.test.mjs"],
    cost: "the delivery tool's own suites: every scripts/ocv-tools test, about 70 files",
  },
  typecheck: {
    id: "typecheck",
    cmd: "pnpm",
    args: ["run", "typecheck"],
    cost: "a typecheck of every package through turbo",
  },
  lint: {
    id: "lint",
    cmd: "pnpm",
    args: ["run", "lint"],
    cost: "eslint on every package through turbo",
  },
})

export const packageProof = (pkg) => ({
  id: `test ${pkg.name}`,
  cmd: "pnpm",
  args: ["--filter", pkg.name, "test"],
  cost: `the whole ${pkg.name} suite (${pkg.dir})`,
})

export const NO_TESTS_BY_NATURE = Object.freeze([
  {
    pattern: /^docs\/.+\.md$/,
    reason:
      "Markdown under docs/ is prose for people with no code to run; the repository-wide text guards that read every file run on GitHub",
  },
])

const OWN_PACKAGE = "package"

export const CONFIG_PROOFS = Object.freeze([
  {
    pattern: /^scripts\/ocv-tools\//,
    proofs: ["tools"],
    reason:
      "a delivery-tool file; its suites reach it through the command line, deeper than one import",
  },
  {
    pattern: /^packages\/guards\/[^/]+\.mjs$/,
    proofs: ["guards"],
    reason:
      "part of the guards suite runner; only a run of the whole suite proves it",
  },
  {
    pattern: /^\.githooks\//,
    proofs: ["guards"],
    reason:
      "a git hook; the guards suite drives the hooks and the tool behind them",
  },
  {
    pattern: /^(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml)$/,
    proofs: ["typecheck", "guards"],
    reason:
      "the workspace's dependencies and scripts; every package's typecheck and the workspace-script guards read it",
  },
  {
    pattern: /^(?:apps|packages)\/[^/]+\/package\.json$/,
    proofs: [OWN_PACKAGE, "typecheck", "guards"],
    reason:
      "a package's dependencies and scripts; its own suite, every package's typecheck and the workspace-script guards read it",
  },
  {
    pattern: /(?:^|\/)tsconfig[^/]*\.json$/,
    proofs: ["typecheck"],
    reason: "a TypeScript config; only a typecheck of every package proves it",
  },
  {
    pattern: /(?:^|\/)turbo\.json$/,
    proofs: ["guards"],
    reason: "a turbo pipeline; the workspace-script guards read it",
  },
  {
    pattern: /(?:^|\/)(?:vite|vitest)\.config\.[cm]?[jt]s$/,
    proofs: [OWN_PACKAGE],
    reason:
      "a vite or vitest config; it changes how the whole package suite runs",
  },
  {
    pattern: /(?:^|\/)eslint\.config\.[cm]?[jt]s$/,
    proofs: ["lint"],
    reason: "an eslint config; only eslint on every package proves it",
  },
])

export function configRule(file) {
  if (isTestFile(file)) return null
  return CONFIG_PROOFS.find((row) => row.pattern.test(file)) ?? null
}

function proofsOf(ids, pkg) {
  return ids.map((id) =>
    id === OWN_PACKAGE
      ? pkg?.testScript
        ? packageProof(pkg)
        : PROOFS.guards
      : PROOFS[id]
  )
}

function unknown(file, says, proofs) {
  return { file, rule: "unknown", says, proofs }
}

function weakOrUnknown(file, { packages, runners, ranByRunner }) {
  const pkg = packageOf(file, packages)
  if (!pkg) {
    if (file.startsWith(SCRIPTS_RUNNER.root))
      return unknown(file, "no scripts test imports it", [PROOFS.guards])
    return unknown(file, "outside every package and every test map", [
      PROOFS.guards,
    ])
  }
  if (!pkg.testScript)
    return unknown(
      file,
      `${pkg.name} has no test script, so nothing here can run its tests; add one`,
      [PROOFS.guards]
    )
  if (!pkg.runner)
    return unknown(
      file,
      `the ${pkg.name} test script cannot run single files`,
      [packageProof(pkg)]
    )
  const runner = runnerOf(file, runners) ?? pkg.runner
  const ran = ranByRunner.get(runner.name) ?? 0
  if (file.startsWith(pkg.runner.source) && ran > 0)
    return {
      file,
      rule: "package",
      says: `no test imports or scans it, directly or through other files; ${ran} ${pkg.name} test file(s) run here and the quick checks typecheck it`,
      proofs: [],
    }
  return unknown(
    file,
    ran > 0
      ? `a ${pkg.name} file outside its source folder that no test reaches`
      : `no ${pkg.name} test reaches it`,
    [packageProof(pkg)]
  )
}

export function accountFor({
  changed,
  reach,
  packages,
  runners,
  ranByRunner,
  notRun = [],
  unrun = new Map(),
  closures = new Map(),
  imports = new Map(),
  all = false,
}) {
  const skipped = new Set(notRun)
  const runnerProof = (name) => {
    const pkg = packages.find((p) => p.runner?.name === name)
    return pkg?.testScript ? packageProof(pkg) : PROOFS.guards
  }
  const entries = changed.map((file) => {
    if (skipped.has(file)) {
      const pkg = packageOf(file, packages)
      return unknown(
        file,
        "a changed test that was selected and not run here (over the per-runner cap)",
        [pkg?.testScript ? packageProof(pkg) : PROOFS.guards]
      )
    }
    const config = configRule(file)
    if (config)
      return {
        file,
        rule: "config",
        says: config.reason,
        proofs: proofsOf(config.proofs, packageOf(file, packages)),
      }
    const reader = (closures.get(file) ?? []).find(
      (by) => configRule(by) && !isTestFile(by)
    )
    const readerProofs = reader
      ? proofsOf(configRule(reader).proofs, packageOf(reader, packages))
      : []
    const missing = unrun.get(file)
    if (missing && !all)
      return {
        file,
        rule: "partial",
        says: `${missing.ran} of the ${missing.total} test file(s) that reach it ran here; CI runs the rest, first ${missing.missing[0]}`,
        proofs: readerProofs,
      }
    if (missing)
      return unknown(
        file,
        `${missing.total} test file(s) reach it and check --all asked for all of them, so ${missing.missing.length} more run in the whole suite, first ${missing.missing[0]}`,
        [
          ...new Map(
            [...missing.runners.map(runnerProof), ...readerProofs].map(
              (proof) => [proof.id, proof]
            )
          ).values(),
        ]
      )
    if (reader)
      return {
        file,
        rule: "config",
        says: `${reader} reads it, so it counts as that file: ${configRule(reader).reason}`,
        proofs: readerProofs,
      }
    const tests = reach.get(file) ?? []
    if (tests.length)
      return {
        file,
        rule: "tests",
        says:
          tests.length === 1 && tests[0] === file
            ? "it is a test and runs"
            : (imports.get(file) ?? 1) === 0
              ? `no test imports it, directly or through other files; the ${tests.length} test file(s) that scan its folder run, first ${tests[0]}`
              : `runs all ${tests.length} test file(s) that reach it, first ${tests[0]}`,
        proofs: [],
      }
    const allowed = NO_TESTS_BY_NATURE.find((row) => row.pattern.test(file))
    if (allowed)
      return { file, rule: "no-tests", says: allowed.reason, proofs: [] }
    return weakOrUnknown(file, { packages, runners, ranByRunner })
  })
  const ran = [...ranByRunner.values()].reduce((n, count) => n + count, 0)
  const proofs = new Map()
  for (const entry of entries)
    for (const proof of entry.proofs) proofs.set(proof.id, proof)
  if (!ran && !proofs.size && entries.some((e) => e.rule !== "no-tests"))
    proofs.set(PROOFS.guards.id, PROOFS.guards)
  return { entries, proofs: [...proofs.values()] }
}

const LABEL = {
  tests: "runs tests",
  "no-tests": "no tests by nature",
  package: "package runner",
  config: "needs a larger run",
  partial: "partial, rest in CI",
  unknown: "UNKNOWN",
}

export const proofCommand = (proof) =>
  [proof.cmd, ...proof.args.map((a) => (/\*/.test(a) ? `"${a}"` : a))].join(" ")

export function describeAccounting(accounting) {
  const lines = [
    `affected tests: each of the ${accounting.entries.length} changed file(s) and the rule that accounts for it:`,
  ]
  const ordered = [...accounting.entries].sort(
    (a, b) =>
      Number(b.proofs.length > 0) - Number(a.proofs.length > 0) ||
      a.file.localeCompare(b.file)
  )
  for (const entry of ordered.slice(0, LISTED_FILES))
    lines.push(`  ${entry.file}: ${LABEL[entry.rule]} (${entry.says})`)
  if (ordered.length > LISTED_FILES)
    lines.push(
      `  ... and ${ordered.length - LISTED_FILES} more, none of them needing a larger run`
    )
  for (const proof of accounting.proofs)
    lines.push(`affected tests: needs ${proofCommand(proof)}  [${proof.cost}]`)
  return lines
}
