import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import test from "node:test"
import { CI_ONLY_GUARDS, FAST_GUARDS, quickPlan } from "./push-checks.mjs"

const root = new URL("../../../", import.meta.url).pathname

test("a root guard is a push check unless CI_ONLY_GUARDS names it", () => {
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
    .filter((file) => file && file.split("/").length === 2)
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
    ["prettier", "eslint apps/api", "no-comments", "fast guards"]
  )
})
