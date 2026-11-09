import { readdirSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
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

export const CI_ONLY_GUARDS = Object.freeze([
  "scripts/approve-railway-deploys.test.mjs",
  "scripts/no-comments.test.mjs",
  "scripts/verify-auth-production.test.mjs",
  "scripts/web-lint-rules.test.mjs",
])

const ROOT = fileURLToPath(new URL("../../../", import.meta.url))
const NESTED_FAST_GUARDS = ["scripts/ocv-tools/rules-doc.test.mjs"]

export const FAST_GUARDS = Object.freeze([
  ...readdirSync(join(ROOT, "scripts"))
    .filter((name) => name.endsWith(".test.mjs"))
    .map((name) => `scripts/${name}`)
    .filter((file) => !CI_ONLY_GUARDS.includes(file))
    .sort(),
  ...NESTED_FAST_GUARDS,
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

export const COLOR_ENV = Object.freeze(["FORCE_COLOR"])

const batches = (list) => {
  const out = []
  for (let i = 0; i < list.length; i += BATCH)
    out.push(list.slice(i, i + BATCH))
  return out
}

export function quickPlan(files, top) {
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

export function runQuickChecks(ctx, top) {
  const files = changedFiles(ctx, top)
  const lines =
    files === null
      ? [
          "pre-push: origin/main is missing, so prettier and eslint are skipped.",
        ]
      : []
  const failed = []
  const plan = quickPlan(files ?? [], top)
  for (const step of plan) {
    const r = run(ctx, step.cmd, step.args, {
      cwd: step.cwd ?? top,
      inherit: true,
    })
    if (!r.ok) failed.push(step.label)
  }
  return { failed: [...new Set(failed)], lines }
}
