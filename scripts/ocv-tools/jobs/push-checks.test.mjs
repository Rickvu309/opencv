import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"
import { SLOW, discoverTests } from "../../../packages/guards/run-tests.mjs"
import {
  CI_ONLY_GUARDS,
  FAST_GUARDS,
  TYPECHECK_PROJECTS,
  WORKSPACE_USES,
  readsBuiltOutput,
  quickPlan,
  typecheckDirs,
  workspaceUses,
} from "./push-checks.mjs"

const root = new URL("../../../", import.meta.url).pathname

test("a root guard stays on the merge preflight unless CI_ONLY_GUARDS names it", () => {
  const listed = execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "scripts/*.test.mjs",
    ],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter(
      (file) => file && file.split("/").length === 2 && existsSync(root + file)
    )
  for (const file of listed)
    assert.equal(
      FAST_GUARDS.includes(file),
      !CI_ONLY_GUARDS.includes(file),
      file
    )
  for (const file of CI_ONLY_GUARDS) assert.ok(existsSync(root + file), file)
  for (const file of FAST_GUARDS) assert.ok(existsSync(root + file), file)
  const both = FAST_GUARDS.filter((file) => CI_ONLY_GUARDS.includes(file))
  assert.deepEqual(both, [])
})

test("the plan has no turbo, test runner or build step", () => {
  const plan = quickPlan(["apps/api/src/a.ts", "docs/a.md"], "/repo")
  const text = plan.map((step) => [step.cmd, ...step.args].join(" ")).join("\n")
  assert.doesNotMatch(text, /turbo|pnpm|vitest|vite build|playwright|chrom/i)
  assert.deepEqual(
    plan.map((step) => step.label),
    ["prettier", "eslint apps/api", "typecheck apps/api", "no-comments"]
  )
  assert.ok(!plan.some((step) => step.args.includes("--test")))
})

test("the GitHub guards job runs every file the push used to run", () => {
  const extra = execFileSync(
    "git",
    ["ls-files", "-z", "scripts/ocv-tools/*.test.mjs"],
    { cwd: root, encoding: "utf8" }
  )
    .split("\0")
    .filter(Boolean)
  const hook = new Set([...FAST_GUARDS, ...extra])
  const ci = new Set([...discoverTests(), SLOW])
  const missing = [...hook].filter((file) => !ci.has(file)).sort()
  assert.deepEqual(missing, [])
  assert.ok(hook.has("scripts/local-port-range.test.mjs"))
  assert.ok(hook.has("scripts/ocv-tools/rules-doc.test.mjs"))
})

const USES = {
  "apps/api": ["packages/domain"],
  "apps/web": ["packages/domain", "packages/ui"],
  "packages/domain": [],
  "packages/ui": [],
}

test("a change is typechecked in its package and in every package that uses it", () => {
  assert.deepEqual(typecheckDirs(["docs/a.md", "scripts/a.mjs"], USES), [])
  assert.deepEqual(typecheckDirs(["apps/web/src/a.css"], USES), [])
  assert.deepEqual(typecheckDirs(["apps/web/src/a.tsx"], USES), ["apps/web"])
  assert.deepEqual(typecheckDirs(["packages/ui/src/a.tsx"], USES), [
    "apps/web",
    "packages/ui",
  ])
  assert.deepEqual(typecheckDirs(["apps/api/tsconfig.json"], USES), [
    "apps/api",
  ])
  assert.deepEqual(typecheckDirs(["packages/ui/package.json"], USES), [
    "apps/web",
    "packages/ui",
  ])
  assert.deepEqual(typecheckDirs(["packages/domain/src/a.ts"], USES), [
    "apps/api",
    "apps/web",
    "packages/domain",
  ])
})

test("the package links come from each package file", () => {
  const read = (dir) =>
    ({
      "apps/api": {
        name: "api",
        dependencies: { "@workspace/domain": "workspace:*", hono: "1" },
      },
      "apps/web": {
        name: "web",
        devDependencies: { "@workspace/ui": "workspace:*" },
      },
      "packages/domain": { name: "@workspace/domain" },
      "packages/ui": { name: "@workspace/ui" },
    })[dir]
  assert.deepEqual(workspaceUses(read), {
    "apps/api": ["packages/domain"],
    "apps/web": ["packages/ui"],
    "packages/domain": [],
    "packages/ui": [],
  })
  assert.deepEqual(WORKSPACE_USES, USES)
})

test("each typecheck step is incremental, emits nothing and runs in its package", () => {
  const steps = quickPlan(["apps/web/src/a.tsx"], "/repo", USES).filter(
    (step) => step.label.startsWith("typecheck")
  )
  assert.deepEqual(
    steps.map((step) => [step.cwd, step.args[1]]),
    [
      ["/repo/apps/web", "tsconfig.app.json"],
      ["/repo/apps/web", "tsconfig.node.json"],
    ]
  )
  for (const step of steps) {
    assert.equal(step.cmd, "/repo/apps/web/node_modules/.bin/tsc")
    assert.ok(step.args.includes("--noEmit"))
    assert.ok(step.args.includes("--incremental"))
  }
})

const BUILT = { name: "@workspace/domain", types: "./dist/index.d.ts" }

test("a project that would read a package's built output is named", () => {
  assert.deepEqual(readsBuiltOutput('{ "compilerOptions": {} }', [BUILT]), [
    "@workspace/domain",
  ])
  assert.deepEqual(
    readsBuiltOutput(
      '{\n  /* note */\n  "compilerOptions": { "paths": { "@/*": ["./src/*"], "@workspace/domain": ["../domain/src/index.ts"] } } }',
      [BUILT]
    ),
    []
  )
  assert.deepEqual(
    readsBuiltOutput(
      '{ "compilerOptions": { "customConditions": ["opencv-source"] } }',
      [BUILT]
    ),
    []
  )
  assert.deepEqual(
    readsBuiltOutput("{}", [{ name: "@workspace/ui", types: undefined }]),
    []
  )
})

test("no typecheck project on the push needs a build first", () => {
  const packageOf = (dir) =>
    JSON.parse(readFileSync(`${root}${dir}/package.json`, "utf8"))
  for (const [dir, projects] of Object.entries(TYPECHECK_PROJECTS)) {
    const used = WORKSPACE_USES[dir].map(packageOf)
    for (const project of projects)
      assert.deepEqual(
        readsBuiltOutput(
          readFileSync(`${root}${dir}/${project}`, "utf8"),
          used
        ),
        [],
        `${dir}/${project}`
      )
  }
})
