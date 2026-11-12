import assert from "node:assert/strict"
import test from "node:test"

import { contextOptions } from "./fresh-account.mjs"

test("a recipe's browser context never loads the shared account the stack signed in", () => {
  const shared = { storageState: "/scratch/storage.json" }
  const reusesShared = (options) => "storageState" in options
  assert.equal(
    reusesShared({ ...contextOptions({ width: 1440 }), ...shared }),
    true
  )
  assert.equal(reusesShared(contextOptions({ width: 1440 })), false)
  assert.deepEqual(
    contextOptions({ width: 390, scale: 2 }).deviceScaleFactor,
    2
  )
})
