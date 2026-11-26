import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  controlProblems,
  declaredResourceNames,
  detect,
  RESOURCES_FILE,
} from "./lib/control-resource-names.mjs"

const names = ["job.priority", "paper.label"]

test("reads every resource the contract declares", () => {
  const declared = declaredResourceNames(readFileSync(RESOURCES_FILE, "utf8"))
  for (const name of names) assert.ok(declared.includes(name), name)
})

test("fires on Control naming a context's resource, as the first priority grant did", () => {
  assert.deepEqual(
    detect(
      'if (write.name !== "job.priority" || !write.entityId) continue',
      "write-grant.ts",
      names
    ).map((problem) => problem.name),
    ["job.priority"]
  )
})

test("stays quiet when Control reads what the contract declares on the resource", () => {
  assert.deepEqual(
    detect("if (!write.versioned || !write.entityId) continue", "x.ts", names),
    []
  )
})

test("no Control source names a context's resource", () => {
  assert.deepEqual(
    controlProblems(),
    [],
    "Control grants and checks a resource by what the contract declares on it, such as `versioned`. Mark the resource in packages/domain/src/resources.ts instead of naming it in Control."
  )
})
