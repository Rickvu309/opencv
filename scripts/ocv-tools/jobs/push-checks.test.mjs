import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import test from "node:test"
import { SLOW, discoverTests } from "../../../packages/guards/run-tests.mjs"
import { CI_ONLY_GUARDS, FAST_GUARDS, quickPlan } from "./push-checks.mjs"

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
    ["prettier", "eslint apps/api", "no-comments"]
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
