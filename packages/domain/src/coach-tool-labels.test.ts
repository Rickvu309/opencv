import assert from "node:assert/strict"
import test from "node:test"

import { catalog } from "./generated/catalog.ts"
import { chatToolNameSchema } from "./coach/public.ts"

test("every operation Coach can call names its own label", () => {
  const operations = catalog as Record<string, { label?: string } | undefined>
  const missing = chatToolNameSchema.options.filter(
    (name) => !operations[name]?.label?.trim()
  )
  assert.deepEqual(
    missing,
    [],
    "Give each of these operations a `label` in its defineOperation, the words Coach shows when it takes the action"
  )
})
