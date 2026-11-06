import assert from "node:assert/strict"
import { it } from "node:test"
import {
  connectionPolicySchema,
  connectionResourcesSchema,
} from "./connections.ts"
import { connectionIdSchema } from "./ids.ts"
import { connectionsContract } from "./connections-contract.ts"

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
  assert.equal(connectionsContract["connections.revoke"].coach, "never")
  assert.deepEqual(
    connectionsContract["connections.revoke"].invalidates({
      connectionId: connectionIdSchema.parse(
        "11070000-0000-4000-8000-000000000001"
      ),
    }),
    [{ query: "connections.list" }]
  )
})
