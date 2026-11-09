import { randomUUID } from "node:crypto"
import { coachActor, defineOperation, personActor } from "@workspace/domain"
import { eq } from "drizzle-orm"
import { expect } from "vitest"
import { z } from "zod"
import { getDb, insideTransaction, withDatabase } from "../db/context.js"
import { activity, chats, coachUsage, idempotency, user } from "../db/schema.js"
import { bindCatalog } from "../registry/bind.js"
import type { ReviewedCommand } from "../registry/frozen-review.js"
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
const snapshot = z.object({ before: z.string() }).strict()
type Snapshot = z.output<typeof snapshot>
export const words = { before: "Ada", after: "Grace" }

export function fixture(
  options: {
    silent?: boolean
    prepare?: () => Promise<void>
    revalidate?: () => Promise<void>
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
    prepare: async (input: Input) => {
      calls.prepare++
      expect(insideTransaction()).toBe(false)
      expect(trace.active).toBe(0)
      await options.prepare?.()
      await Promise.resolve()
      expect(insideTransaction()).toBe(false)
      if (options.unchanged && input.before === input.after)
        return {
          kind: "unchanged",
          snapshot: { before: input.before },
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
      revalidate: async (_input, saved, actor) => {
        calls.revalidate++
        expect(insideTransaction()).toBe(true)
        await options.revalidate?.()
        if ((await nameOf(actor.userId)) !== saved.before)
          throw new Error("Basis conflict")
      },
    },
    revalidate: async (
      input: Input,
      prepared: { candidate: Candidate; review: Review },
      actor: { userId: string }
    ) => {
      calls.revalidate++
      expect(insideTransaction()).toBe(true)
      await options.revalidate?.()
      const [head] = await getDb()
        .select()
        .from(user)
        .where(eq(user.id, actor.userId))
      if (
        head?.name !== input.before ||
        prepared.candidate.after !== input.after ||
        prepared.review.after !== input.after
      )
        throw new Error("Basis conflict")
    },
    commit: async (
      _input: Input,
      prepared: { candidate: Candidate; review: Review },
      actor: { userId: string }
    ) => {
      calls.commit++
      expect(insideTransaction()).toBe(true)
      await getDb()
        .update(user)
        .set({ name: prepared.candidate.after })
        .where(eq(user.id, actor.userId))
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
