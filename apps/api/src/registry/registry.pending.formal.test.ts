import {} from "node:crypto"

import { and, eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import {} from "zod"

import { withDatabase } from "../db/context.js"
import { activity, jobs, pendingActions } from "../db/schema.js"
import {} from "./errors.js"
import {} from "./registry.js"
import {
  NS,
  SEEDS,
  activityKeyed,
  backend,
  commandErrorOf,
  delaysFor,
  describeError,
  measure,
  newPerson,
  prng,
  race,
  registry,
  registerBackendHooks,
} from "../test/registry-formal-support.js"
import { seedCoachActor } from "../test/coach-turn.js"

registerBackendHooks()
// ---------------------------------------------------------------- P2 ----

async function pendingJobMove() {
  const { id: userId, person } = await newPerson()
  const chat = await registry.execute({
    name: "chat.create",
    input: {},
    actor: person,
  })
  const chatId = (chat.output as { id: string }).id
  const created = await registry.execute({
    name: "job.create",
    input: { title: "Intern", company: "Northwind" },
    actor: person,
  })
  const jobId = (created.output as { id: string }).id
  const pending = await registry.execute({
    name: "job.move",
    input: { jobId, stage: "applied" },
    actor: await seedCoachActor(userId, chatId),
  })
  if (!pending.pendingActionId) throw new Error("expected a pending action")
  return { userId, jobId, pendingId: pending.pendingActionId }
}

async function settled(userId: string, jobId: string, pendingId: string) {
  const [pending] = await backend.db
    .select()
    .from(pendingActions)
    .where(eq(pendingActions.id, pendingId))
  const [job] = await backend.db.select().from(jobs).where(eq(jobs.id, jobId))
  const moves = await backend.db
    .select()
    .from(activity)
    .where(and(eq(activity.userId, userId), eq(activity.command, "job.move")))
  return {
    status: pending?.status,
    stage: job?.stage,
    moves: moves.length,
    keyed: (await activityKeyed(userId, pendingId)).length,
  }
}

describe("P2: a pending action is executed at most once", () => {
  it("N racing approves run the command once and return one activity row", async () => {
    await withDatabase(backend.db, async () => {
      for (const n of NS) {
        for (const seed of SEEDS) {
          const { userId, jobId, pendingId } = await pendingJobMove()
          const label = `P2 approve x${n} seed=${seed}`
          const outcomes = await measure("P2 approve", () =>
            race(
              Array.from(
                { length: n },
                () => () => registry.approve(userId, pendingId)
              ),
              delaysFor(seed, n)
            )
          )
          const after = await settled(userId, jobId, pendingId)
          expect(after, label).toEqual({
            status: "approved",
            stage: "applied",
            moves: 1,
            keyed: 1,
          })
          expect(
            outcomes.map((o) => (o.ok ? "ok" : describeError(o.error))),
            label
          ).toEqual(Array(n).fill("ok"))
          const ids = new Set(outcomes.map((o) => (o.ok ? o.value?.id : null)))
          expect(ids.size, `${label}: one activity id`).toBe(1)
        }
      }
    })
  }, 120_000)

  it("approve and deny racing never both win", async () => {
    await withDatabase(backend.db, async () => {
      const mixes: Array<[number, number]> = [
        [1, 1],
        [2, 1],
        [1, 2],
        [2, 2],
      ]
      for (const [approves, denies] of mixes) {
        for (const seed of SEEDS) {
          const { userId, jobId, pendingId } = await pendingJobMove()
          const label = `P2 approve x${approves} deny x${denies} seed=${seed}`
          const calls: Array<() => Promise<unknown>> = [
            ...Array.from(
              { length: approves },
              () => () => registry.approve(userId, pendingId)
            ),
            ...Array.from(
              { length: denies },
              () => () => registry.deny(userId, pendingId)
            ),
          ]
          const next = prng(seed + approves * 7 + denies * 13)
          const order = calls
            .map((call, index) => ({ call, index, at: next() }))
            .sort((a, b) => a.at - b.at)
          const outcomes = await measure("P2 approve vs deny", () =>
            race(
              order.map((item) => item.call),
              delaysFor(seed, calls.length)
            )
          )
          const kinds = order.map((item) =>
            item.index < approves ? "approve" : "deny"
          )
          const after = await settled(userId, jobId, pendingId)
          const winner = after.status
          expect(["approved", "denied"], label).toContain(winner)
          if (winner === "approved") {
            expect(after, label).toMatchObject({
              stage: "applied",
              moves: 1,
              keyed: 1,
            })
          } else {
            expect(after, label).toMatchObject({
              stage: "saved",
              moves: 0,
              keyed: 0,
            })
          }
          outcomes.forEach((outcome, i) => {
            const kind = kinds[i]
            const wins =
              (kind === "approve" && winner === "approved") ||
              (kind === "deny" && winner === "denied")
            if (wins) {
              expect(
                outcome.ok,
                `${label}: ${kind} ${describeError(outcome.ok ? "" : outcome.error)}`
              ).toBe(true)
            } else {
              expect(outcome.ok, `${label}: ${kind} should lose`).toBe(false)
              expect(commandErrorOf(outcome)?.code, label).toBe("CONFLICT")
            }
          })
        }
      }
    })
  }, 120_000)
})
