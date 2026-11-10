import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect } from "./lib/railway-approval-gate.mjs"

const file = ".github/workflows/nightly.yml"
const clean =
  "jobs:\n  approve-railway:\n    if: ${{ github.event_name == 'push' }}\n    runs-on: ubuntu-latest\n"
const waits = clean
  .replace("    if:", "    needs: full\n    if:")
  .replace("== 'push'", "== 'push' && needs.full.result == 'success'")

test("approval that waits for the full run is refused", () => {
  assert.ok(detect(waits, file).length)
  assert.deepEqual(detect(clean, file), [])
  assert.deepEqual(detect(waits, "other.yml"), [])
})

test("a missing approval refuses the workflow", () => {
  assert.ok(detect("jobs:\n  full:\n    runs-on: ubuntu-latest\n", file).length)
})

test("approval on the long check or only after success is refused", () => {
  for (const condition of [
    "always()",
    "true",
    "github.event_name == 'schedule'",
    "github.event_name == 'workflow_dispatch'",
    "github.event_name == 'push' && needs.full.result == 'success'",
    "always() || needs.full.result == 'success'",
    "github.event_name == 'push' && needs.full.result != 'cancelled'",
    "unknown()",
  ])
    assert.ok(
      detect(clean.replace(/if: .+/, "if: ${{ " + condition + " }}"), file)
        .length,
      condition
    )
})

test("a reversed push check stays valid", () => {
  const reversed = clean.replace(
    "github.event_name == 'push'",
    "'push' == github.event_name"
  )
  assert.deepEqual(detect(reversed, file), [])
})

test("the main workflow approves on push and keeps the long check on its schedule", () => {
  const workflow = readFileSync(
    new URL("../.github/workflows/nightly.yml", import.meta.url),
    "utf8"
  )
  assert.deepEqual(detect(workflow, file), [])
  assert.match(
    workflow,
    /full:[\s\S]*github\.event_name == 'schedule'[\s\S]*github\.event_name == 'workflow_dispatch'/
  )
  assert.match(workflow, /cron: "17 19 \* \* \*"/)
  assert.match(workflow, /workflow_dispatch:/)
  assert.match(workflow, /Full run failed on main/)
  assert.doesNotMatch(
    workflow,
    /needs: full\n    if: \$\{\{ github\.event_name == 'push'/
  )
})
