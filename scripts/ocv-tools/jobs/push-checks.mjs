import { join } from "node:path"
import { run } from "./common.mjs"

const BATCH = 200
const LINTABLE = /\.(?:[cm]?[jt]s|[jt]sx)$/
const LINT_DIRS = [
  "apps/api",
  "apps/web",
  "packages/domain",
  "packages/paper-crdt",
  "packages/ui",
]

export const FAST_GUARDS = Object.freeze([
  "scripts/adr-citations.test.mjs",
  "scripts/blocknote-dependencies.test.mjs",
  "scripts/check.test.mjs",
  "scripts/checks-doc.test.mjs",
  "scripts/ci-screens.test.mjs",
  "scripts/ci-workflow.test.mjs",
  "scripts/doc-paths.test.mjs",
  "scripts/ds-codemod.test.mjs",
  "scripts/driver-sign-in.test.mjs",
  "scripts/focus-indication.test.mjs",
  "scripts/guard-ledger.test.mjs",
  "scripts/kit-duplicates.test.mjs",
  "scripts/layout-comparison-gates.test.mjs",
  "scripts/main-checkout-hook.test.mjs",
  "scripts/nav-pending.test.mjs",
  "scripts/paper-save-keeps-parts.test.mjs",
  "scripts/pointer-capture.test.mjs",
  "scripts/raw-tlc.test.mjs",
  "scripts/retired-words.test.mjs",
  "scripts/skill-routes.test.mjs",
  "scripts/skills-tracked.test.mjs",
  "scripts/tla-specs.test.mjs",
  "scripts/temp-dirs.test.mjs",
  "scripts/touch-targets.test.mjs",
  "scripts/unbounded-spawn.test.mjs",
  "scripts/unused-domain-exports.test.mjs",
  "scripts/verify-bad-fixtures.test.mjs",
  "scripts/verify-feature-map.test.mjs",
  "scripts/web-test-clock.test.mjs",
  "scripts/ocv-tools/rules-doc.test.mjs",
])

export const CI_ONLY_GUARDS = Object.freeze([
  "scripts/approve-railway-deploys.test.mjs",
  "scripts/browser-launcher.test.mjs",
  "scripts/no-comments.test.mjs",
  "scripts/pen-snapshot.test.mjs",
  "scripts/verify-auth-production.test.mjs",
  "scripts/web-lint-rules.test.mjs",
])

export const GIT_ENV = Object.freeze([
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GIT_PREFIX",
  "GIT_COMMON_DIR",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_NAMESPACE",
  "GIT_CEILING_DIRECTORIES",
])

const batches = (list) => {
  const out = []
  for (let i = 0; i < list.length; i += BATCH)
    out.push(list.slice(i, i + BATCH))
  return out
}

export function quickPlan(files, top, toolTests = []) {
  const steps = []
  for (const paths of batches(files))
    steps.push({
      label: "prettier",
      cmd: join(top, "node_modules/.bin/prettier"),
      args: [
        "--check",
        "--ignore-unknown",
        "--log-level",
        "warn",
        "--",
        ...paths,
      ],
    })
  for (const dir of LINT_DIRS) {
    const own = files.filter(
      (file) => file.startsWith(`${dir}/`) && LINTABLE.test(file)
    )
    for (const paths of batches(own))
      steps.push({
        label: `eslint ${dir}`,
        cmd: join(top, dir, "node_modules/.bin/eslint"),
        args: [
          "--no-warn-ignored",
          "--max-warnings=0",
          ...paths.map((path) => path.slice(dir.length + 1)),
        ],
        cwd: join(top, dir),
      })
  }
  steps.push({
    label: "no-comments",
    cmd: "node",
    args: ["scripts/no-comments.mjs"],
  })
  const touched = files.some((file) => file.startsWith("scripts/ocv-tools/"))
  steps.push({
    label: "fast guards",
    cmd: "env",
    args: [
      ...GIT_ENV.flatMap((name) => ["-u", name]),
      "node",
      "--test",
      "--test-concurrency=3",
      "--test-reporter=dot",
      ...new Set([...FAST_GUARDS, ...(touched ? toolTests : [])]),
    ],
  })
  return steps
}

export function changedFiles(ctx, top) {
  const base = run(ctx, "git", ["merge-base", "origin/main", "HEAD"], {
    cwd: top,
  })
  if (!base.ok) return null
  const diff = run(
    ctx,
    "git",
    [
      "diff",
      "--name-only",
      "--no-renames",
      "--diff-filter=ACMR",
      "-z",
      base.out,
      "HEAD",
    ],
    { cwd: top, raw: true }
  )
  return diff.out.split("\0").filter(Boolean)
}

function toolTests(ctx, top) {
  const listed = run(
    ctx,
    "git",
    ["ls-files", "-z", "scripts/ocv-tools/*.test.mjs"],
    {
      cwd: top,
      raw: true,
    }
  )
  return listed.out.split("\0").filter(Boolean)
}

export function runQuickChecks(ctx, top) {
  const files = changedFiles(ctx, top)
  const lines =
    files === null
      ? [
          "pre-push: origin/main is missing, so prettier and eslint are skipped.",
        ]
      : []
  const touched = (files ?? []).some((file) =>
    file.startsWith("scripts/ocv-tools/")
  )
  const failed = []
  const plan = quickPlan(files ?? [], top, touched ? toolTests(ctx, top) : [])
  for (const step of plan) {
    const r = run(ctx, step.cmd, step.args, {
      cwd: step.cwd ?? top,
      inherit: true,
    })
    if (!r.ok) failed.push(step.label)
  }
  return { failed: [...new Set(failed)], lines }
}
