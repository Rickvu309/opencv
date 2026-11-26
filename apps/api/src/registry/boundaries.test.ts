import { personActor } from "@workspace/domain/kernel"
import { z } from "zod"
import { withDatabase } from "../db/context.js"
import { idempotency, user } from "../db/schema.js"
import { createMigratedTestDb } from "../test/harness.js"
import { Registry } from "./registry.js"
import { inputHash } from "./receipt.js"
import { describe, expect, it, vi } from "vitest"

describe("command input boundary", () => {
  it("hashes schema-parsed inputs with omitted undefined fields and stable key order", async () => {
    const { db, client } = await createMigratedTestDb()
    try {
      await db.insert(user).values({
        id: "canonical-owner",
        name: "Before",
        email: "canonical@test.local",
      })
      await withDatabase(db, async () => {
        const registry = new Registry()
        const execute = vi.fn(async (input: { a: number; b?: number }) => input)
        registry.addCommand(
          {
            name: "job.rename",
            description: "Canonical input fixture",
            input: z.object({
              a: z.number(),
              b: z.number().optional(),
              label: z.string().default("parsed"),
            }),
            coach: "auto",
            destructive: false,
            step: () => "Canonical input fixture",
            reversal: () => null,
            activity: () => null,
          },
          execute
        )
        const actor = personActor("canonical-owner")
        for (const [index, input] of [
          { a: 1, b: undefined },
          { a: 1 },
          { b: undefined, a: 1 },
        ].entries()) {
          const idempotencyKey = `canonical-${index}`
          const first = await registry.execute({
            name: "job.rename",
            input,
            actor,
            idempotencyKey,
          })
          for (const retry of [
            { a: 1 },
            { a: 1, b: undefined },
            { b: undefined, a: 1, label: "parsed" },
          ])
            await expect(
              registry.execute({
                name: "job.rename",
                input: retry,
                actor,
                idempotencyKey,
              })
            ).resolves.toMatchObject({
              pending: false,
              output: JSON.parse(JSON.stringify(first.output)),
            })
        }
        expect(execute).toHaveBeenCalledTimes(3)
        const rows = await db.select().from(idempotency)
        expect(rows).toHaveLength(3)
        expect(new Set(rows.map((row) => row.inputHash))).toEqual(
          new Set([inputHash({ a: 1, label: "parsed" })])
        )
        const request = {
          name: "job.rename",
          input: { a: 1, b: 2 },
          actor,
          idempotencyKey: "ordered",
        }
        const first = await registry.execute(request)
        await expect(
          registry.execute({ ...request, input: { b: 2, a: 1 } })
        ).resolves.toMatchObject({
          pending: false,
          output: JSON.parse(JSON.stringify(first.output)),
        })
        expect(execute).toHaveBeenCalledTimes(4)
      })
    } finally {
      await client.close()
    }
  })
})
