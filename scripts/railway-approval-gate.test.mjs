import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect } from "./lib/railway-approval-gate.mjs"

const ciFile = ".github/workflows/ci.yml"
const nightlyFile = ".github/workflows/nightly.yml"
const greenMainPush =
  "github.event_name == 'push' && github.ref == 'refs/heads/main' && needs.ci.result == 'success'"
const approval = (condition, needs = "    needs: ci\n") =>
  `jobs:\n  ci:\n    runs-on: ubuntu-latest\n\n  approve-railway:\n${needs}    if: \${{ ${condition} }}\n    runs-on: ubuntu-latest\n    env:\n      GITHUB_SHA: \${{ github.sha }}\n    steps:\n      - run: node scripts/approve-railway-deploys.mjs\n`
const clean = approval(greenMainPush)

const workflow = (name) =>
  readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), "utf8")

test("approval that does not wait for the ci job is refused", () => {
  assert.deepEqual(detect(clean, ciFile), [])
  assert.ok(detect(approval(greenMainPush, ""), ciFile).length)
  assert.ok(
    detect(approval(greenMainPush, "    needs: guards\n"), ciFile).length
  )
  assert.deepEqual(
    detect(approval(greenMainPush, "    needs: [guards, ci]\n"), ciFile),
    []
  )
  assert.deepEqual(detect(approval(greenMainPush, ""), "other.yml"), [])
})

test("approval left in the nightly workflow is refused", () => {
  const nightly =
    "jobs:\n  approve-railway:\n    if: ${{ github.event_name == 'push' }}\n    steps:\n      - run: node scripts/approve-railway-deploys.mjs\n"
  assert.ok(detect(nightly, nightlyFile).length)
  assert.deepEqual(
    detect("jobs:\n  full:\n    runs-on: ubuntu-latest\n", nightlyFile),
    []
  )
})

test("a missing approval refuses the workflow", () => {
  assert.ok(detect("jobs:\n  ci:\n    runs-on: ubuntu-latest\n", ciFile).length)
})

test("approval on any run but a green push to main is refused", () => {
  for (const condition of [
    "always()",
    "true",
    "github.event_name == 'push'",
    "github.event_name == 'push' && always()",
    "github.event_name == 'push' && github.ref == 'refs/heads/main' && always()",
    "always() && github.event_name == 'push' && github.ref == 'refs/heads/main' && needs.ci.result != 'cancelled'",
    "github.event_name == 'merge_group' && needs.ci.result == 'success'",
    "github.ref == 'refs/heads/main' && needs.ci.result == 'success'",
    "github.event_name == 'push' && github.ref == 'refs/heads/main' || needs.ci.result == 'success'",
    "unknown()",
  ])
    assert.ok(detect(approval(condition), ciFile).length, condition)
})

test("approval that names no tested commit is refused", () => {
  const untied = clean.replace("      GITHUB_SHA: ${{ github.sha }}\n", "")
  assert.ok(detect(untied, ciFile).length)
})

test("a reversed push check stays valid", () => {
  for (const condition of [
    "'push' == github.event_name && 'refs/heads/main' == github.ref && 'success' == needs.ci.result",
    "github.event_name == 'push' && github.ref == 'refs/heads/main'",
    "success() && github.event_name == 'push' && github.ref == 'refs/heads/main'",
  ])
    assert.deepEqual(detect(approval(condition), ciFile), [], condition)
})

test("ci approves a green push to main and nightly keeps the long check on its schedule", () => {
  assert.deepEqual(detect(workflow("ci.yml"), ciFile), [])
  const nightly = workflow("nightly.yml")
  assert.deepEqual(detect(nightly, nightlyFile), [])
  assert.match(
    nightly,
    /full:[\s\S]*github\.event_name == 'schedule'[\s\S]*github\.event_name == 'workflow_dispatch'/
  )
  assert.match(nightly, /cron: "17 19 \* \* \*"/)
  assert.match(nightly, /workflow_dispatch:/)
  assert.match(nightly, /Full run failed on main/)
})
