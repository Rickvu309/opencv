import {} from "node:crypto"

import {} from "@workspace/domain"
import { eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import { withDatabase } from "../db/context.js"
import { activity, jobs } from "../db/schema.js"
import {} from "./errors.js"
import { Registry } from "./registry.js"
import {
  NS,
  SEEDS,
  activityKeyed,
  backend,
  commandErrorOf,
  delaysFor,
  measure,
  newPerson,
  race,
  registry,
  registerBackendHooks,
  storedKeyed,
} from "./registry-formal-support.js"

registerBackendHooks()
// ---------------------------------------------------------------- P3 ----

describe("P3: an activity row is undone at most once", () => {
  it("N racing undos run the reversal once; the rest are refused as already undone", async () => {
    await withDatabase(backend.db, async () => {
      for (const n of NS) {
        for (const seed of SEEDS) {
          const { id: userId, person } = await newPerson()
          const created = await registry.execute({
            name: "job.create",
            input: { title: "Undo me", company: "Northwind" },
            actor: person,
          })
          const jobId = (created.output as { id: string }).id
          const activityId = created.activityId
          if (!activityId) throw new Error("expected an activity row")
          const label = `P3 undo x${n} seed=${seed}`
          const outcomes = await measure("P3 undo", () =>
            race(
              Array.from(
                { length: n },
                () => () => registry.undo(userId, activityId)
              ),
              delaysFor(seed, n)
            )
          )
          const won = outcomes.filter((o) => o.ok)
          expect(won.length, `${label}: callers that undid`).toBe(1)
          for (const o of outcomes.filter((x) => !x.ok)) {
            const error = commandErrorOf(o)
            expect(error?.code, label).toBe("CONFLICT")
            expect(error?.message, label).toMatch(/already undone/)
          }
          // The reversal's own key is recorded once, in whichever table it writes.
          const reversalKey = `undo:${activityId}`
          const recorded =
            (await activityKeyed(userId, reversalKey)).length +
            (await storedKeyed(userId, reversalKey)).length
          expect(recorded, `${label}: reversal recorded`).toBe(1)
          const [row] = await backend.db
            .select()
            .from(activity)
            .where(eq(activity.id, activityId))
          expect(row?.undoneAt, label).not.toBeNull()
          const left = await backend.db
            .select()
            .from(jobs)
            .where(eq(jobs.id, jobId))
          expect(left.length, `${label}: job removed`).toBe(0)
        }
      }
    })
  }, 120_000)

  it("an activity row with no reversal is refused every time and stays not undone", async () => {
    await withDatabase(backend.db, async () => {
      const local = new Registry()
      let reversalsRun = 0
      local.addCommand(
        {
          name: "formal.irreversible",
          description: "Formal check command.",
          input: z.object({}).strict(),
          coach: "never",
          destructive: false,
          reversal: () => null,
          step: () => "Formal check",
          activity: () => ({
            subjectKind: "chat",
            subjectId: "formal",
            summary: "Formal",
          }),
        },
        async () => {
          reversalsRun += 1
          return {}
        }
      )
      for (const n of NS) {
        for (const seed of SEEDS) {
          const { id: userId, person } = await newPerson()
          const done = await local.execute({
            name: "formal.irreversible",
            input: {},
            actor: person,
          })
          const activityId = done.activityId
          if (!activityId) throw new Error("expected an activity row")
          const [before] = await backend.db
            .select()
            .from(activity)
            .where(eq(activity.id, activityId))
          expect(before?.reversalCommand).toBeNull()
          const ran = reversalsRun
          const label = `P3 no reversal x${n} seed=${seed}`
          const outcomes = await measure("P3 no reversal", () =>
            race(
              Array.from(
                { length: n },
                () => () => local.undo(userId, activityId)
              ),
              delaysFor(seed, n)
            )
          )
          for (const o of outcomes) {
            expect(o.ok, label).toBe(false)
            const error = commandErrorOf(o)
            expect(error?.code, label).toBe("CONFLICT")
            expect(error?.message, label).toMatch(/cannot be undone/)
          }
          const [after] = await backend.db
            .select()
            .from(activity)
            .where(eq(activity.id, activityId))
          expect(after?.undoneAt, label).toBeNull()
          expect(reversalsRun, label).toBe(ran)
        }
      }
    })
  }, 120_000)
})
