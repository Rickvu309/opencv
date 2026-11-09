import { randomUUID } from "node:crypto"
import { coachActor, defineOperation, personActor } from "@workspace/domain"
import { and, eq, sql } from "drizzle-orm"
import type { Pool } from "pg"
import { expect } from "vitest"
import { z } from "zod"
import { getDb, insideTransaction, withDatabase } from "../db/context.js"
import { activity, chats, coachUsage, idempotency, user } from "../db/schema.js"
import { bindCatalog } from "../registry/bind.js"
import type {
  BasisLock,
  BasisToken,
  ReviewedCommand,
} from "../registry/frozen-review.js"
import { Registry } from "../registry/registry.js"
import { backend, trace } from "./registry-formal-support.js"

export const operation = defineOperation({
  kind: "command",
  owner: "fixture",
  name: "fixture.review",
  version: 1,
  description: "Review a replacement",
  coach: "confirm",
  destructive: false,
  idempotency: "keyed",
  writes: () => [],
  input: z
    .object({
      before: z.string(),
      after: z.string().trim(),
      legacy: z.boolean().optional(),
    })
    .strict(),
  publicResult: z.object({ text: z.string() }).strict(),
})
export const candidate = z
  .object({ artifact: z.string(), before: z.string(), after: z.string() })
  .strict()
export const review = z
  .object({ before: z.string(), after: z.string() })
  .strict()
export type Input = z.output<typeof operation.input>
type Candidate = z.output<typeof candidate>
type Review = z.output<typeof review>
const snapshot = z.object({ before: z.string(), userId: z.string() }).strict()
type Snapshot = z.output<typeof snapshot>
export type BasisAttack =
  "plain" | "keyShare" | "wrongRow" | "missing" | "lockTable" | "wrongWhere"
export const words = { before: "Ada", after: "Grace" }

export function fixture(
  options: {
    silent?: boolean
    prepare?: () => Promise<void>
    revalidate?: () => Promise<void>
    beforeLock?: () => Promise<void>
    afterLock?: () => Promise<void>
    afterRead?: () => Promise<void>
    beforeMutationLock?: () => Promise<void>
    afterMutationLock?: () => Promise<void>
    lock?: boolean
    attack?: BasisAttack
    decoyId?: string
    basisUserId?: string
    fail?: boolean
    version?: string
    select?: (input: Readonly<Input>) => "execute" | "reviewed"
    unchanged?: boolean
  } = {}
) {
  const calls = { prepare: 0, commit: 0, revalidate: 0, execute: 0 }
  const reviewed: ReviewedCommand<
    Input,
    { text: string },
    Candidate,
    Review,
    Snapshot
  > = {
    version: options.version ?? "fixture-v1",
    candidate,
    review,
    prepare: async (input: Input, actor) => {
      calls.prepare++
      expect(insideTransaction()).toBe(false)
      expect(trace.active).toBe(0)
      await options.prepare?.()
      await Promise.resolve()
      expect(insideTransaction()).toBe(false)
      if (options.unchanged && input.before === input.after)
        return {
          kind: "unchanged",
          snapshot: {
            before: input.before,
            userId: options.basisUserId ?? actor.userId,
          },
          output: { text: input.after },
        }
      return {
        candidate: {
          before: input.before,
          after: input.after,
          artifact: `private-${randomUUID()}`,
        },
        review: { before: input.before, after: input.after },
      }
    },
    unchanged: {
      snapshot,
      key: (saved) => saved.userId,
      expect: (saved) => saved.before,
      lock: (saved, _actor, basis) => readUnchangedBasis(saved, basis, options),
      revalidate: async () => {
        calls.revalidate++
        expect(insideTransaction()).toBe(true)
        await options.revalidate?.()
      },
    },
    basisKey: (_input, _prepared, actor) => actor.userId,
    basisValue: (input) => input.before,
    revalidate: async (
      input: Input,
      prepared: { candidate: Candidate; review: Review },
      actor: { userId: string },
      basis: BasisLock
    ) => {
      calls.revalidate++
      expect(insideTransaction()).toBe(true)
      await options.beforeMutationLock?.()
      const token = await basis.forUpdate({
        table: user,
        where: eq(user.id, actor.userId),
        columns: { id: user.id, name: user.name },
        key: actor.userId,
        keyColumn: "id",
        valueColumn: "name",
      })
      await options.afterMutationLock?.()
      await options.revalidate?.()
      if (
        prepared.candidate.after !== input.after ||
        prepared.review.after !== input.after
      )
        throw new Error("Basis conflict")
      return token
    },
    commit: async (
      _input: Input,
      prepared: { candidate: Candidate; review: Review },
      actor: { userId: string }
    ) => {
      calls.commit++
      expect(insideTransaction()).toBe(true)
      const rows = await getDb()
        .update(user)
        .set({ name: prepared.candidate.after })
        .where(
          and(
            eq(user.id, actor.userId),
            eq(user.name, prepared.candidate.before)
          )
        )
        .returning({ id: user.id })
      if (rows.length === 0) throw new Error("Basis conflict")
      if (options.fail) throw new Error("Commit refused")
      return { text: prepared.candidate.after }
    },
  }
  const common = {
    operation,
    activity: (
      _input: Input,
      result: { text: string },
      actor: { userId: string }
    ) =>
      options.silent
        ? null
        : {
            subjectKind: "account" as const,
            subjectId: actor.userId,
            summary: result.text,
          },
  }
  const execute = async (input: Input, actor: { userId: string }) => {
    calls.execute++
    expect(insideTransaction()).toBe(true)
    await getDb()
      .update(user)
      .set({ name: input.after })
      .where(eq(user.id, actor.userId))
    return { text: input.after }
  }
  const binding = options.select
    ? { ...common, selected: { select: options.select, execute, reviewed } }
    : { ...common, reviewed }
  const registry = new Registry()
  bindCatalog(registry, { "fixture.review": binding })
  return { registry, calls }
}

export async function owner() {
  const id = randomUUID(),
    chatId = randomUUID(),
    turnId = randomUUID()
  await getDb()
    .insert(user)
    .values({ id, name: "Ada", email: `${id}@test.local` })
  await getDb()
    .insert(chats)
    .values({ id: chatId, userId: id, title: "Review" })
  await getDb().insert(coachUsage).values({
    id: turnId,
    userId: id,
    chatId,
    plan: "free",
    mode: "free",
    provider: "fake",
    model: "fake",
  })
  return { id, person: personActor(id), coach: coachActor(id, chatId, turnId) }
}

export const run = (effect: () => Promise<void>) =>
  withDatabase(backend.db, effect)
export async function receiptCount(id: string) {
  const rows = await getDb()
    .select()
    .from(activity)
    .where(eq(activity.userId, id))
  const keys = await getDb()
    .select()
    .from(idempotency)
    .where(eq(idempotency.userId, id))
  return rows.length + keys.length
}
export async function nameOf(id: string) {
  return (await getDb().select().from(user).where(eq(user.id, id)))[0]?.name
}

export async function readUnchangedBasis(
  saved: { before: string; userId: string },
  basis: BasisLock,
  options: {
    lock?: boolean
    attack?: BasisAttack
    decoyId?: string
    beforeLock?: () => Promise<void>
    afterLock?: () => Promise<void>
    afterRead?: () => Promise<void>
  }
): Promise<BasisToken> {
  const attack =
    options.attack ?? (options.lock === false ? "plain" : undefined)
  await options.beforeLock?.()
  const forged = async () => {
    await options.afterRead?.()
    return { key: saved.userId, value: saved.before }
  }
  if (attack === "plain") {
    await nameOf(saved.userId)
    return forged()
  }
  if (attack === "keyShare") {
    await getDb().execute(
      sql`select name from opencv_app."user" where id = ${saved.userId} for key share`
    )
    return forged()
  }
  if (attack === "wrongRow") {
    await getDb().execute(
      sql`select name from opencv_app."user" where id = ${options.decoyId!} for update`
    )
    await nameOf(saved.userId)
    return forged()
  }
  if (attack === "missing") {
    await getDb().execute(
      sql`select name from opencv_app."user" where id = ${"missing-" + saved.userId} for update`
    )
    await nameOf(saved.userId)
    return forged()
  }
  if (attack === "lockTable") {
    await getDb().execute(sql`lock table opencv_app."user" in row share mode`)
    await nameOf(saved.userId)
    return forged()
  }
  if (attack === "wrongWhere")
    return basis.forUpdate({
      table: user,
      where: eq(user.id, options.decoyId!),
      columns: { id: user.id, name: user.name },
      key: saved.userId,
      keyColumn: "id",
      valueColumn: "name",
    })
  const token = await basis.forUpdate({
    table: user,
    where: eq(user.id, saved.userId),
    columns: { id: user.id, name: user.name },
    key: saved.userId,
    keyColumn: "id",
    valueColumn: "name",
  })
  await options.afterLock?.()
  return token
}

export async function compareAndRestore(
  userId: string,
  expected: string,
  prior: string
) {
  const rows = await getDb()
    .update(user)
    .set({ name: prior })
    .where(and(eq(user.id, userId), eq(user.name, expected)))
    .returning({ id: user.id })
  if (rows.length === 0) throw new Error("Later typing")
}

export async function commitOtherName(id: string, name: string) {
  const pool = (backend.db as unknown as { $client: Pool }).$client
  const client = await pool.connect()
  try {
    const pid = await client.query<{ pid: number }>(
      "select pg_backend_pid() as pid"
    )
    await client.query(`update opencv_app."user" set name = $1 where id = $2`, [
      name,
      id,
    ])
    return pid.rows[0]!.pid
  } finally {
    client.release()
  }
}

export async function otherBlocked(pid: number) {
  const pool = (backend.db as unknown as { $client: Pool }).$client
  const probe = await pool.connect()
  try {
    const locks = await probe.query(
      `select 1 from pg_locks waiter
       where waiter.pid <> $1
         and not waiter.granted
         and waiter.locktype = 'transactionid'
         and waiter.mode = 'ShareLock'
         and exists (
           select 1 from pg_locks holder
           where holder.pid = $1
             and holder.granted
             and holder.locktype = 'transactionid'
             and holder.mode = 'ExclusiveLock'
             and holder.transactionid = waiter.transactionid
         )
       limit 1`,
      [pid]
    )
    return (locks.rowCount ?? 0) > 0
  } finally {
    probe.release()
  }
}

export function undoFixture(
  fail: () => boolean = () => false,
  pause?: () => Promise<void>
) {
  const registry = new Registry()
  const restore = "fixture.restorePrivate"
  let restores = 0
  registry.addQuery({
    name: "fixture.currentName",
    description: "Read the current name",
    input: z.object({}).strict(),
    coach: false,
    step: () => "Read the name",
    read: async (_input, actor) => ({ name: await nameOf(actor.userId) }),
  })
  registry.addUndoCommand(
    {
      name: restore,
      description: "Restore the exact prior text",
      input: z.object({ expected: z.string(), prior: z.string() }).strict(),
      coach: "never",
      destructive: false,
      step: () => "Restore text",
      reversal: () => null,
      activity: () => null,
    },
    async (input, actor) => {
      expect(insideTransaction()).toBe(true)
      if (pause) await pause()
      await compareAndRestore(actor.userId, input.expected, input.prior)
      restores++
      if (fail()) throw new Error("Restore refused")
      return { restored: true }
    }
  )
  registry.addCommand(
    {
      name: "fixture.write",
      description: "Write text",
      input: z.object({ before: z.string(), after: z.string() }).strict(),
      coach: "confirm",
      destructive: false,
      step: () => "Write text",
      reversal: (input) => ({
        command: restore,
        input: { expected: input.after, prior: input.before },
        expect: {
          query: "fixture.currentName",
          input: {},
          matches: { name: input.after },
          skipped: "The name changed",
        },
      }),
      activity: (_input, _output, actor) => ({
        subjectKind: "account" as const,
        subjectId: actor.userId,
        summary: "Wrote text",
      }),
    },
    async (input, actor) => {
      await getDb()
        .update(user)
        .set({ name: input.after })
        .where(eq(user.id, actor.userId))
      return { text: input.after }
    }
  )
  return { registry, restore, restores: () => restores }
}
