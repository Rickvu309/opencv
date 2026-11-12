import assert from "node:assert/strict"
import test from "node:test"

import {
  contextOptions,
  freshEmail,
  recipeNonce,
  retryAfterMs,
} from "./fresh-account.mjs"
import { lastSignInCode } from "./stack.mjs"

test("each screen recipe signs in a new empty account, so a repeated shot starts from the same state", () => {
  const runs = [1, 2, 3].map((count) =>
    freshEmail("paper-home", recipeNonce(1_763_000_000_000, count))
  )
  assert.equal(new Set(runs).size, 3)
  for (const email of runs)
    assert.match(email, /^ui-recipe\+paper-home-[a-z0-9]+@example\.com$/)
  assert.notEqual(recipeNonce(), recipeNonce())
})

test("the sign-in code is read for the recipe's own account, not an earlier one", () => {
  const first = freshEmail("coach-home", "a1")
  const second = freshEmail("coach-home", "a2")
  const log = [
    `[auth] email code for ${first} type sign-in: 111111`,
    `[auth] email code for ${second} type sign-in: 222222`,
  ].join("\n")
  assert.equal(lastSignInCode(log, first), "111111")
  assert.equal(lastSignInCode(log, second), "222222")
})

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

test("a limited sign-in waits as long as the api asks before it tries again", () => {
  assert.equal(retryAfterMs({ "x-retry-after": "7" }), 7000)
  assert.equal(retryAfterMs({ "retry-after": "2" }), 2000)
  assert.equal(retryAfterMs({}), 10_000)
})
