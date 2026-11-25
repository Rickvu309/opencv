import assert from "node:assert/strict"
import { it } from "node:test"
import {
  connectionResourcesSchema,
  connectionSchema,
} from "./agents/connections.ts"
import { connectionIdSchema } from "./ids.ts"
import { operation as list } from "./operations/connections/list/operation.ts"
import { operation as revoke } from "./operations/connections/revoke/operation.ts"

const connectionPolicySchema = connectionSchema.shape.policy

it("defaults to no career resources and requires approval for every write", () => {
  assert.deepEqual(connectionResourcesSchema.parse({ kind: "none" }), {
    kind: "none",
  })
  assert.equal(
    connectionResourcesSchema.safeParse({ kind: "all" }).success,
    false
  )
  assert.deepEqual(
    connectionPolicySchema.parse({ reads: "allow", writes: "approval" }),
    { reads: "allow", writes: "approval" }
  )
  assert.equal(
    connectionPolicySchema.safeParse({ reads: "allow", writes: "allow" })
      .success,
    false
  )
})

it("only accepts connection identifiers and keeps revoke unavailable to Coach", () => {
  assert.equal(connectionIdSchema.safeParse("other").success, false)
  assert.equal(revoke.coach, "never")
  assert.deepEqual(
    revoke.writes({
      connectionId: connectionIdSchema.parse(
        "11070000-0000-4000-8000-000000000001"
      ),
    }),
    list.dependsOn({})
  )
})
