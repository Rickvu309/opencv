import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import test from "node:test"
import { CI_ONLY_GUARDS, FAST_GUARDS, quickPlan } from "./push-checks.mjs"

const root = new URL("../../../", import.meta.url).pathname

test("every root guard is either a push check or left to CI", () => {
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
  const known = new Set([...FAST_GUARDS, ...CI_ONLY_GUARDS])
  const unsorted = listed.filter((file) => !known.has(file))
  assert.deepEqual(unsorted, [], "add each to FAST_GUARDS or CI_ONLY_GUARDS")
  for (const file of known) assert.ok(existsSync(root + file), file)
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
