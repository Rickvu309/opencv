import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import {
  FIX,
  describeCheck,
  listGuardFiles,
  renderChecks,
  root,
} from "./list-checks.mjs"
import { CI_ONLY_GUARDS, FAST_GUARDS } from "./ocv-tools/jobs/push-checks.mjs"

test("the guard list renders every guard with its own top-level test name and is not committed", () => {
  assert.doesNotThrow(() => renderChecks())
  assert.equal(
    existsSync(path.join(root, "docs/agents/checks.md")),
    false,
    `docs/agents/checks.md is generated on demand, so two pull requests that add a guard never conflict. Delete it and run: ${FIX}`
  )
})

test("a describe name beats the first test name, and a multi-line name reads whole", () => {
  assert.equal(
    describeCheck('it("inner", () => {})\ndescribe("outer", () => {})'),
    "outer"
  )
  assert.equal(
    describeCheck(
      'import x from "y"\ntest(\n  "a name on its own line",\n  () => {}\n)'
    ),
    "a name on its own line"
  )
  assert.equal(
    describeCheck('describe.skip("skipped but named", () => {})'),
    "skipped but named"
  )
  assert.equal(describeCheck("export const nothing = 1"), null)
})

test("a guard with no top-level name fails the render and a stale list names the fix", () => {
  assert.throws(
    () =>
      renderChecks({
        files: ["scripts/a.test.mjs"],
        read: () => "export const nothing = 1",
      }),
    /scripts\/a\.test\.mjs has no top-level test name/
  )
  const fresh = renderChecks({
    files: ["scripts/a.test.mjs"],
    read: () => 'test("holds", () => {})',
    fast: ["scripts/a.test.mjs"],
  })
  assert.match(fresh, /- `a\.test\.mjs` \(push, CI\): holds/)
})

test("guard discovery finds files by the groups and skips others", () => {
  const files = listGuardFiles(
    () =>
      "scripts/b.test.mjs\nscripts/ocv-tools/x.test.mjs\nREADME.md\napps/web/src/test/c.test.tsx\n"
  )
  assert.deepEqual(files, [
    "apps/web/src/test/c.test.tsx",
    "scripts/b.test.mjs",
  ])
})

test("this guard is classified for push or CI, never both", () => {
  const me = "scripts/checks-doc.test.mjs"
  assert.equal(
    [...FAST_GUARDS, ...CI_ONLY_GUARDS].filter((file) => file === me).length,
    1
  )
})
