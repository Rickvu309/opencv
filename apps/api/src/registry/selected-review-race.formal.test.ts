import { randomUUID } from "node:crypto"
import { eq, sql } from "drizzle-orm"
import { expect, it } from "vitest"
import { getDb } from "../db/context.js"
import { activity, user } from "../db/schema.js"
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
  type BasisAttack,
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

async function secondUser() {
  const id = randomUUID()
  await getDb()
    .insert(user)
    .values({ id, name: "X", email: `${id}@test.local` })
  return id
}

function weakReceipt(
  actor: Awaited<ReturnType<typeof owner>>,
  attack: BasisAttack,
  decoyId?: string
) {
  return fixture({
    select,
    unchanged: true,
    attack,
    decoyId,
    afterRead: async () => {
      const mine = await getDb().execute<{ pid: number }>(
        sql`select pg_backend_pid() as pid`
      )
      const other = await commitOtherName(actor.id, "Bob")
      expect(other).not.toBe(Number(mine.rows[0]?.pid))
    },
  })
}

async function refusesWeak(
  actor: Awaited<ReturnType<typeof owner>>,
  attack: BasisAttack,
  decoyId?: string
) {
  const { registry } = weakReceipt(actor, attack, decoyId)
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
}

it.skipIf(!REAL)(
  "for key share of the basis does not let the unchanged receipt commit",
  () => run(async () => refusesWeak(await owner(), "keyShare")),
  20_000
)

it.skipIf(!REAL)(
  "for update of a different row does not let the unchanged receipt commit",
  () =>
    run(async () => {
      const actor = await owner()
      await refusesWeak(actor, "wrongRow", await secondUser())
    }),
  20_000
)

it.skipIf(!REAL)(
  "lock table in row share mode does not let the unchanged receipt commit",
  () => run(async () => refusesWeak(await owner(), "lockTable")),
  20_000
)

it.skipIf(!REAL)(
  "for update of a missing id does not let the unchanged receipt commit",
  () => run(async () => refusesWeak(await owner(), "missing")),
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

it("for update of a different row through the basis lock does not publish", () =>
  run(async () => {
    const actor = await owner()
    const decoyId = await secondUser()
    await getDb().update(user).set({ name: "Bob" }).where(eq(user.id, actor.id))
    const { registry } = fixture({
      select,
      unchanged: true,
      attack: "wrongWhere",
      decoyId,
    })
    await expect(
      registry.execute({
        name: operation.name,
        input: { before: "Ada", after: "Ada" },
        actor: actor.person,
        idempotencyKey: randomUUID(),
      })
    ).rejects.toThrow("The unchanged basis row does not match")
    expect(await receiptCount(actor.id)).toBe(0)
    expect(await nameOf(actor.id)).toBe("Bob")
  }))

it.skipIf(!REAL)(
  "a reviewed write does not publish over a name committed before its lock",
  () =>
    run(async () => {
      const actor = await owner()
      const { registry, calls } = fixture({
        select,
        beforeMutationLock: async () => {
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
