import { randomUUID } from "node:crypto"
import { eq, sql } from "drizzle-orm"
import { expect, it } from "vitest"
import { getDb } from "../db/context.js"
import { activity } from "../db/schema.js"
import {
  commitOtherName,
  fixture,
  nameOf,
  operation,
  otherBlocked,
  owner,
  receiptCount,
  run,
  undoFixture,
  words,
} from "../test/frozen-review-support.js"
import { REAL, registerBackendHooks } from "../test/registry-formal-support.js"

registerBackendHooks()

const select = (input: { legacy?: boolean }) =>
  input.legacy ? "execute" : "reviewed"

it("an unchanged revalidate that does not lock its basis refuses before a receipt", () =>
  run(async () => {
    const actor = await owner()
    const { registry } = fixture({ select, unchanged: true, lock: false })
    await expect(
      registry.execute({
        name: operation.name,
        input: { before: "Ada", after: "Ada" },
        actor: actor.person,
        idempotencyKey: randomUUID(),
      })
    ).rejects.toThrow("The unchanged check did not lock its basis")
    expect(await receiptCount(actor.id)).toBe(0)
    expect(await nameOf(actor.id)).toBe("Ada")
  }))

it.skipIf(!REAL)(
  "a stale unlocked compare refuses when another session commits the basis first",
  () =>
    run(async () => {
      const actor = await owner()
      const { registry } = fixture({
        select,
        unchanged: true,
        lock: false,
        afterRead: async () => {
          const mine = await getDb().execute<{ pid: number }>(
            sql`select pg_backend_pid() as pid`
          )
          const other = await commitOtherName(actor.id, "Bob")
          expect(other).not.toBe(Number(mine.rows[0]?.pid))
        },
      })
      await expect(
        registry.execute({
          name: operation.name,
          input: { before: "Ada", after: "Ada" },
          actor: actor.person,
          idempotencyKey: randomUUID(),
        })
      ).rejects.toThrow("The unchanged check did not lock its basis")
      expect(await receiptCount(actor.id)).toBe(0)
      expect(await nameOf(actor.id)).toBe("Bob")
    }),
  20_000
)

it.skipIf(!REAL)(
  "an overlapping commit after the basis read and before the receipt does not commit",
  () =>
    run(async () => {
      const actor = await owner()
      const { registry } = fixture({
        select,
        unchanged: true,
        beforeLock: async () => {
          expect(await nameOf(actor.id)).toBe("Ada")
          const mine = await getDb().execute<{ pid: number }>(
            sql`select pg_backend_pid() as pid`
          )
          const other = await commitOtherName(actor.id, "Bob")
          expect(other).not.toBe(Number(mine.rows[0]?.pid))
        },
      })
      await expect(
        registry.execute({
          name: operation.name,
          input: { before: "Ada", after: "Ada" },
          actor: actor.person,
          idempotencyKey: randomUUID(),
        })
      ).rejects.toThrow("Basis conflict")
      expect(await receiptCount(actor.id)).toBe(0)
      expect(await nameOf(actor.id)).toBe("Bob")
    }),
  20_000
)

it.skipIf(!REAL)(
  "the basis lock stops a concurrent write from committing before the unchanged receipt",
  () =>
    run(async () => {
      const actor = await owner()
      let other: Promise<number> | undefined
      const { registry } = fixture({
        select,
        unchanged: true,
        afterLock: async () => {
          const mine = await getDb().execute<{ pid: number }>(
            sql`select pg_backend_pid() as pid`
          )
          other = commitOtherName(actor.id, "Bob")
          let waiting = false
          for (let attempt = 0; attempt < 40 && !waiting; attempt++) {
            waiting = await otherBlocked(Number(mine.rows[0]?.pid))
            if (!waiting)
              await new Promise((resolve) => setTimeout(resolve, 25))
          }
          expect(waiting).toBe(true)
        },
      })
      await expect(
        registry.execute({
          name: operation.name,
          input: { before: "Ada", after: "Ada" },
          actor: actor.person,
          idempotencyKey: randomUUID(),
        })
      ).resolves.toMatchObject({ pending: false, output: { text: "Ada" } })
      await other
      expect(await receiptCount(actor.id)).toBe(1)
      expect(await nameOf(actor.id)).toBe("Bob")
    }),
  20_000
)

it.skipIf(!REAL)(
  "private restore does not overwrite a name committed after its read",
  () =>
    run(async () => {
      const actor = await owner()
      const { registry } = undoFixture(
        () => false,
        async () => {
          const mine = await getDb().execute<{ pid: number }>(
            sql`select pg_backend_pid() as pid`
          )
          const other = await commitOtherName(actor.id, "Newer")
          expect(other).not.toBe(Number(mine.rows[0]?.pid))
        }
      )
      const done = await registry.execute({
        name: "fixture.write",
        input: words,
        actor: actor.person,
        idempotencyKey: randomUUID(),
      })
      await expect(registry.undo(actor.id, done.activityId!)).rejects.toThrow(
        "Later typing"
      )
      expect(await nameOf(actor.id)).toBe("Newer")
      expect(
        (
          await getDb()
            .select()
            .from(activity)
            .where(eq(activity.id, done.activityId!))
        )[0]?.undoneAt
      ).toBeNull()
    }),
  20_000
)
