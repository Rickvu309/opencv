import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { detect } from "./lib/paper-cv-fields.mjs"
import {
  clean,
  scalarField,
  mirror,
  lateAdmission,
  permissiveOrdinary,
  droppedWireMarks,
} from "./paper-cv-fields-fixtures.mjs"

const read = (file) =>
  readFileSync(new URL(`../${file}`, import.meta.url), "utf8")

test("private CV fields retain inline identity and validate detached candidates before writes", () => {
  assert.deepEqual(detect(clean), [])
  for (const [source, kind] of [
    [scalarField, "cv-field-inline-identity-only"],
    [mirror, "cv-field-inline-identity-only"],
    [lateAdmission, "cv-detached-admission-first"],
    [permissiveOrdinary, "cv-ordinary-strict-first"],
    [droppedWireMarks, "cv-wire-before-normalization"],
  ])
    assert.ok(
      detect(source).some((problem) => problem.kind === kind),
      kind
    )
})

test("private CV guard is registered exactly and checks its actual source", () => {
  const row = JSON.parse(read("scripts/guard-ledger/paper-cv-fields.json"))
  assert.equal(row.id, "paper-cv-fields")
  assert.equal(row.file, "scripts/paper-cv-fields.test.mjs")
  assert.deepEqual(row.detector, {
    module: "scripts/lib/paper-cv-fields.mjs",
    export: "detect",
  })
  assert.equal(row.historic, null)
  assert.ok(row.reason.includes("not a historical bug"))
  for (const file of [
    "packages/paper-crdt/src/native-cv-schema.ts",
    "packages/paper-crdt/src/native-cv.ts",
  ])
    assert.deepEqual(detect(read(file), file), [])
})
