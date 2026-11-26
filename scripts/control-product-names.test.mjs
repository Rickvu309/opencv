import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { detectProductNames as detect } from "./lib/control-product-names.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const CONTROL = "apps/api/src/registry/"
const CONTROL_OWN_OPERATIONS = "apps/api/src/registry/operations/"
const DELEGATE_REACH_IS_A_SECOND_LOCK =
  "apps/api/src/registry/delegate-policy.ts"
const OWNERSHIP_MAP_FOR_THE_HARNESS = "apps/api/src/registry/owned.ts"
const RECEIPT_DETAILS_BEFORE_BINDINGS_OWN_THEM =
  "apps/api/src/registry/receipt.ts"
const NAMES_A_PRODUCT_COMMAND_TODAY = [
  RECEIPT_DETAILS_BEFORE_BINDINGS_OWN_THEM,
  DELEGATE_REACH_IS_A_SECOND_LOCK,
  OWNERSHIP_MAP_FOR_THE_HARNESS,
]

const read = (file) => readFileSync(path.join(root, file), "utf8")

const controlSources = () =>
  execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", CONTROL],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter((file) => /\.ts$/.test(file))
    .filter((file) => !/(\.test|\.type-test|\.test-support)\.ts$/.test(file))
    .filter((file) => !file.startsWith(CONTROL_OWN_OPERATIONS))
    .filter((file) => existsSync(path.join(root, file)))

test("Control code names no product command and reads what varies from the operation", () => {
  assert.equal(
    detect(
      'if (entry.name === "paper.edit" && !gates.agentCvs) return "cvs"\nif (entry.name.startsWith("inbox.")) return "email"'
    ).length,
    2
  )
  assert.deepEqual(
    detect(
      'if (entry.permission && !gates[entry.permission]) return entry.permission\nconst kind = "actions.approve"'
    ),
    []
  )
  const hits = controlSources()
    .filter((file) => !NAMES_A_PRODUCT_COMMAND_TODAY.includes(file))
    .flatMap((file) => detect(read(file), file))
  assert.deepEqual(hits, [])
  for (const file of NAMES_A_PRODUCT_COMMAND_TODAY)
    assert.notDeepEqual(
      detect(read(file), file),
      [],
      `${file} no longer names a product command; remove it from the list`
    )
  const historic = execFileSync(
    "git",
    ["show", "6891dd351:apps/api/src/registry/coach-policy.ts"],
    { cwd: root, encoding: "utf8" }
  )
  assert.ok(detect(historic).length > 0)
})
