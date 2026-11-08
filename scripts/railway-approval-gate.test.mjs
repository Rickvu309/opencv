import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect } from "./lib/railway-approval-gate.mjs"

const file = ".github/workflows/nightly.yml"
const mistake =
  "jobs:\n  approve-railway:\n    if: ${{ github.event_name == 'push' }}\n    runs-on: ubuntu-latest\n"
const clean = mistake
  .replace("    if:", "    needs: full\n    if:")
  .replace("== 'push'", "== 'push' && needs.full.result == 'success'")

test("independent approval loses the recovery dependency", () => {
  assert.ok(detect(mistake, file).length)
  assert.deepEqual(detect(clean, file), [])
  assert.deepEqual(detect(mistake, "other.yml"), [])
})

test("a missing approval or wrong dependency refuses the workflow", () => {
  assert.ok(detect("jobs:\n  full:\n    runs-on: ubuntu-latest\n", file).length)
  assert.ok(detect(clean.replace("needs: full\n    ", ""), file).length)
  assert.ok(detect(clean.replace("needs: full", "needs: static"), file).length)
})

test("the gate checks outcomes rather than success words", () => {
  for (const condition of [
    "always()",
    "true",
    "github.event_name == 'push'",
    "always() || needs.full.result == 'success'",
    "github.event_name == 'push' && needs.full.result != 'cancelled'",
    "github.event_name == 'push' && (needs.full.result == 'success' || failure())",
    "unknown()",
  ])
    assert.ok(
      detect(clean.replace(/if: .+/, "if: ${{ " + condition + " }}"), file)
        .length,
      condition
    )
})

test("equivalent dependency lists and reversed predicates remain valid", () => {
  const reversed = clean
    .replace("needs: full", "needs: [full]")
    .replace(
      "github.event_name == 'push' && needs.full.result == 'success'",
      "(needs.full.result == 'success') && ('push' == github.event_name)"
    )
  assert.deepEqual(detect(reversed, file), [])
  assert.deepEqual(
    detect(reversed.replace("needs: [full]", "needs:\n      - full"), file),
    []
  )
})

test("the actual main workflow schedules approval after successful full", () => {
  assert.deepEqual(
    detect(
      readFileSync(
        new URL("../.github/workflows/nightly.yml", import.meta.url),
        "utf8"
      ),
      file
    ),
    []
  )
})
