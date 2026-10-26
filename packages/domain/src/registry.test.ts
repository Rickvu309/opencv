import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { z } from "zod"

import { defineCommand } from "./registry.ts"
import { parseJobId } from "./ids.ts"

describe("defineCommand", () => {
  it("refuses a destructive command the Coach could run on its own", () => {
    assert.throws(
      () =>
        defineCommand({
          name: "job.delete",
          description: "Delete a job",
          input: z.object({}).strict(),
          coach: "auto",
          destructive: true,
          reversal: () => null,
          step: () => "Delete",
          activity: () => null,
        }),
      /destructive/
    )
  })

  it("allows a destructive command that asks first", () => {
    const spec = defineCommand({
      name: "chat.delete",
      description: "Delete a chat",
      input: z.object({}).strict(),
      coach: "confirm",
      destructive: true,
      reversal: () => null,
      step: () => "Delete the chat",
      activity: () => null,
    })
    assert.equal(spec.coach, "confirm")
  })
})

describe("ids", () => {
  it("rejects a job id that is not a uuid", () => {
    assert.throws(() => parseJobId("not-a-job"), /Invalid job id/)
  })
})
