import { randomUUID } from "node:crypto"
import { eq, sql } from "drizzle-orm"
import { expect, it } from "vitest"
import { getDb } from "../db/context.js"
import { activity, user } from "../db/schema.js"
import type { LockedBasis, RowBasis } from "./frozen-review.js"
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

export function projectedBasisIsRejected() {
  const basis: RowBasis = {
    table: user,
    key: [{ column: user.id, source: "snapshot", field: "userId" }],
    compared: [{ column: user.name, source: "snapshot", field: "before" }],
    // @ts-expect-error a where clause cannot choose the locked row
    where: eq(user.id, "decoy"),
  }
  const selected: RowBasis = {
    table: user,
    key: [{ column: user.id, source: "snapshot", field: "userId" }],
    compared: [{ column: user.name, source: "snapshot", field: "before" }],
    // @ts-expect-error a select list cannot supply the compared value
    columns: { id: user.id, name: user.name },
  }
  const empty: RowBasis = {
    table: user,
    // @ts-expect-error the locked row needs a key column
    key: [],
    compared: [{ column: user.name, source: "snapshot", field: "before" }],
  }
  const locked: LockedBasis = Object.freeze({
    key: Object.freeze(["user"]),
    compared: Object.freeze(["Ada"]),
  })
  let held = false
  try {
    // @ts-expect-error the compared value cannot be reassigned
    locked.compared[0] = "Bob"
  } catch {
    held = true
  }
  return (
    basis.table === user &&
    selected.key.length === 1 &&
    empty.compared.length === 1 &&
    held &&
    locked.compared[0] === "Ada"
  )
}

it("a decoy where, a projected select list, and a rewritten value are not a basis", () => {
  expect(projectedBasisIsRejected()).toBe(true)
})

it.skipIf(!REAL)(
  "a name committed by another session before the lock refuses the unchanged receipt",
  () =>
    run(async () => {
      const actor = await owner()
      await commitOtherName(actor.id, "Bob")
      const { registry } = fixture({ select, unchanged: true })
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

it("the only basis lock refuses a missing named row without a receipt", () =>
  run(async () => {
    const actor = await owner()
    await getDb().update(user).set({ name: "Bob" }).where(eq(user.id, actor.id))
    const { registry } = fixture({
      select,
      unchanged: true,
      basisUserId: randomUUID(),
    })
    await expect(
      registry.execute({
        name: operation.name,
        input: { before: "Ada", after: "Ada" },
        actor: actor.person,
        idempotencyKey: randomUUID(),
      })
    ).rejects.toThrow("The unchanged basis row is missing")
    expect(await receiptCount(actor.id)).toBe(0)
    expect(await nameOf(actor.id)).toBe("Bob")
  }))

it.skipIf(!REAL)(
  "a reviewed write does not publish over a name committed before its lock",
  () =>
    run(async () => {
      const actor = await owner()
      await commitOtherName(actor.id, "Bob")
      const { registry, calls } = fixture({ select })
      await expect(
        registry.execute({
          name: operation.name,
          input: words,
          actor: actor.person,
          idempotencyKey: randomUUID(),
        })
      ).rejects.toThrow("Basis conflict")
      expect(calls.commit).toBe(0)
      expect(await receiptCount(actor.id)).toBe(0)
      expect(await nameOf(actor.id)).toBe("Bob")
    }),
  20_000
)

it.skipIf(!REAL)(
  "the reviewed write lock blocks a concurrent update until the receipt commits",
  () =>
    run(async () => {
      const actor = await owner()
      let other: Promise<number> | undefined
      const { registry } = fixture({
        select,
        afterMutationLock: async () => {
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
          input: words,
          actor: actor.person,
          idempotencyKey: randomUUID(),
        })
      ).resolves.toMatchObject({ pending: false, output: { text: "Grace" } })
      await other
      expect(await receiptCount(actor.id)).toBe(1)
      expect(await nameOf(actor.id)).toBe("Bob")
    }),
  20_000
)
