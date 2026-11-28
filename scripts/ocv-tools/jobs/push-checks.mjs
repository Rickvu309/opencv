import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { run } from "./common.mjs"

const BATCH = 200
const LINTABLE = /\.(?:[cm]?[jt]s|[jt]sx)$/
const LINT_DIRS = ["apps/api", "apps/web", "packages/domain", "packages/ui"]

const TYPED = /\.(?:[cm]?ts|tsx)$|(?:^|\/)(?:tsconfig[^/]*|package)\.json$/
const TYPE_PROJECTS = Object.freeze({
  "apps/api": ["tsconfig.json"],
  "apps/web": ["tsconfig.app.json", "tsconfig.node.json"],
  "packages/domain": ["tsconfig.json"],
  "packages/ui": ["tsconfig.json"],
})

export function workspaceUses(readPackage) {
  const packages = LINT_DIRS.map((dir) => ({ dir, ...readPackage(dir) }))
  const dirOf = new Map(packages.map((item) => [item.name, item.dir]))
  return Object.fromEntries(
    packages.map((item) => [
      item.dir,
      Object.keys({ ...item.dependencies, ...item.devDependencies })
        .map((name) => dirOf.get(name))
        .filter(Boolean),
    ])
  )
}

export function typecheckDirs(files, uses) {
  const touched = new Set(
    LINT_DIRS.filter((dir) =>
      files.some((file) => file.startsWith(`${dir}/`) && TYPED.test(file))
    )
  )
  let grew = true
  while (grew) {
    grew = false
    for (const dir of LINT_DIRS) {
      if (touched.has(dir)) continue
      if (!(uses[dir] ?? []).some((used) => touched.has(used))) continue
      touched.add(dir)
      grew = true
    }
  }
  return LINT_DIRS.filter((dir) => touched.has(dir))
}

export const TYPECHECK_PROJECTS = TYPE_PROJECTS

export function readsBuiltOutput(tsconfigText, used) {
  const config = tsconfigText.replace(/^\s*\/\*.*\*\/\s*$/gm, "")
  if (/"customConditions"\s*:\s*\[[^\]]*"opencv-source"/.test(config)) return []
  return used
    .filter((item) => /(^|\/)dist\//.test(item.types ?? ""))
    .filter((item) => !config.includes(`"${item.name}": [`))
    .map((item) => item.name)
}

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

export const WORKSPACE_USES = Object.freeze(
  workspaceUses((dir) =>
    JSON.parse(readFileSync(join(ROOT, dir, "package.json"), "utf8"))
  )
)

const batches = (list) => {
  const out = []
  for (let i = 0; i < list.length; i += BATCH)
    out.push(list.slice(i, i + BATCH))
  return out
}

export function quickPlan(files, top, uses = WORKSPACE_USES, touched = files) {
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
  for (const dir of typecheckDirs(touched, uses))
    for (const project of TYPE_PROJECTS[dir])
      steps.push({
        label: `typecheck ${dir}`,
        cmd: join(top, dir, "node_modules/.bin/tsc"),
        args: [
          "-p",
          project,
          "--noEmit",
          "--incremental",
          "--tsBuildInfoFile",
          `node_modules/.cache/ocv-tools/typecheck/${project}.tsbuildinfo`,
          "--pretty",
          "false",
        ],
        cwd: join(top, dir),
        needsInstall: true,
      })
  steps.push({
    label: "no-comments",
    cmd: "node",
    args: ["scripts/no-comments.mjs"],
  })
  return steps
}

export function changedFiles(ctx, top, kinds = "ACMR") {
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
      `--diff-filter=${kinds}`,
      "-z",
      base.out,
      "HEAD",
    ],
    { cwd: top, raw: true }
  )
  if (!diff.ok)
    throw new Error(
      `git diff of the changed files failed (${diff.err || "no output"}), so the push checks cannot tell what changed; run git diff --name-only origin/main...HEAD and push again`
    )
  return diff.out.split("\0").filter(Boolean)
}

export function runQuickChecks(ctx, top) {
  const files = changedFiles(ctx, top)
  const lines =
    files === null
      ? [
          "pre-push: origin/main is missing, so prettier, eslint and the typecheck are skipped.",
        ]
      : []
  const touched = files === null ? [] : changedFiles(ctx, top, "ACMRD")
  const failed = []
  const plan = quickPlan(files ?? [], top, WORKSPACE_USES, touched ?? [])
  for (const step of plan) {
    if (step.needsInstall && !ctx.ports.fs.exists(step.cmd)) {
      failed.push(
        `${step.label} (the TypeScript tools are not installed here; run pnpm install in this worktree)`
      )
      continue
    }
    const r = run(ctx, step.cmd, step.args, {
      cwd: step.cwd ?? top,
      inherit: true,
    })
    if (!r.ok) failed.push(step.label)
  }
  return { failed: [...new Set(failed)], lines }
}
