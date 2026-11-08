import { ERROR_CODES, type Actor } from "@workspace/domain"
import { z, type ZodType } from "zod"
import { and, eq, sql } from "drizzle-orm"
import { getDb, insideTransaction } from "../db/context.js"
import {
  coachTasks,
  pendingActions,
  idempotency,
  user,
  chats,
} from "../db/schema.js"
import { createId } from "../id.js"
import { CommandError } from "./errors.js"
import { inputHash } from "./receipt.js"
import { createProposal } from "./proposals.js"
import { requireLiveDelegate } from "./delegate-policy.js"
import { activityByKey } from "./registry-reads.js"
import { replay } from "./replay.js"
import type { RanCommand, ExecuteResult } from "./registry-types.js"
import type { TaskLease } from "./task-fence.js"

export type PreparedReview<C, V> = Readonly<{ candidate: C; review: V }>

export type ReviewedCommand<I, O, C, V> = {
  version: string
  candidate: ZodType<C>
  review: ZodType<V>
  prepare: (input: I, actor: Actor) => Promise<PreparedReview<C, V>>
  revalidate: (
    input: I,
    prepared: PreparedReview<C, V>,
    actor: Actor
  ) => Promise<void>
  commit: (input: I, prepared: PreparedReview<C, V>, actor: Actor) => Promise<O>
}

export type StoredReviewedCommand = {
  version: string
  parse: (
    value: PreparedReview<unknown, unknown>
  ) => PreparedReview<unknown, unknown>
  prepare: (
    input: unknown,
    actor: Actor
  ) => Promise<PreparedReview<unknown, unknown>>
  revalidate: (
    input: unknown,
    prepared: PreparedReview<unknown, unknown>,
    actor: Actor
  ) => Promise<void>
  run: (
    input: unknown,
    prepared: PreparedReview<unknown, unknown>,
    actor: Actor
  ) => Promise<RanCommand>
}

const envelopeSchema = z
  .object({
    version: z.literal(1),
    bindingVersion: z.string().min(1),
    proposalId: z.string(),
    ownerId: z.string(),
    command: z.string(),
    inputHash: z.string(),
    key: z.string().nullable(),
    candidate: z.unknown(),
    review: z.unknown(),
    digest: z.string(),
  })
  .strict()

export type FrozenReview = z.infer<typeof envelopeSchema>

const pointerSchema = z
  .object({
    frozenReviewProposal: z.literal(1),
    proposalId: z.string(),
  })
  .strict()

export function frozenPointer(proposalId: string) {
  return { frozenReviewProposal: 1, proposalId }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function immutable<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value)
    for (const child of Object.values(value)) immutable(child)
  }
  return value
}

export function refuseFrozenReview(): never {
  throw new CommandError(
    ERROR_CODES.CONFLICT,
    "The saved review no longer matches this edit"
  )
}

export function requirePreparationBoundary() {
  if (insideTransaction())
    throw new CommandError(
      ERROR_CODES.CONFLICT,
      "Review preparation must start before a transaction"
    )
}

export async function prepareReview(
  binding: StoredReviewedCommand,
  input: unknown,
  actor: Actor,
  command: string,
  key: string | undefined
): Promise<FrozenReview> {
  requirePreparationBoundary()
  const hash = inputHash(input)
  const prepared = clone(
    binding.parse(
      await binding.prepare(immutable(clone(input)), immutable(clone(actor)))
    )
  )
  const body = {
    version: 1 as const,
    bindingVersion: binding.version,
    proposalId: createId(),
    ownerId: actor.userId,
    command,
    inputHash: hash,
    key: key ?? null,
    ...prepared,
  }
  return immutable({ ...body, digest: inputHash(body) })
}

export async function prepareOrReplay(
  binding: StoredReviewedCommand,
  input: unknown,
  actor: Actor,
  command: string,
  key: string | undefined,
  replay: (
    ownerId: string,
    key: string,
    command: string,
    hash: string
  ) => Promise<ExecuteResult | null>
) {
  requirePreparationBoundary()
  const earlier = key
    ? await replay(actor.userId, key, command, inputHash(input))
    : null
  return {
    earlier,
    frozen: earlier
      ? null
      : await prepareReview(binding, input, actor, command, key),
  }
}

export async function reserveFrozenReview(frozen: FrozenReview) {
  if (frozen.key === null) return
  await getDb()
    .insert(idempotency)
    .values({
      userId: frozen.ownerId,
      key: frozen.key,
      command: frozen.command,
      inputHash: frozen.inputHash,
      result: frozenPointer(frozen.proposalId),
    })
}

export function readFrozenReview(
  value: unknown,
  binding: StoredReviewedCommand,
  ownerId: string,
  command: string,
  input: unknown
): FrozenReview {
  const checked = envelopeSchema.safeParse(value)
  if (!checked.success) return refuseFrozenReview()
  const { digest, ...body } = checked.data
  if (
    body.bindingVersion !== binding.version ||
    body.ownerId !== ownerId ||
    body.command !== command ||
    body.inputHash !== inputHash(input) ||
    digest !== inputHash(body)
  )
    return refuseFrozenReview()
  const parsed = binding.parse(body)
  if (
    inputHash(parsed) !==
    inputHash({ candidate: body.candidate, review: body.review })
  )
    return refuseFrozenReview()
  return immutable(clone(checked.data))
}

export function reviewReceiptKey(row: typeof pendingActions.$inferSelect) {
  const stored = envelopeSchema.safeParse(row.frozenReview)
  return stored.success
    ? (stored.data.key ?? row.coachIntentKey ?? row.id)
    : (row.coachIntentKey ?? row.id)
}

export async function replayFrozenProposal(
  value: unknown,
  ownerId: string,
  command: string,
  hash: string,
  binding: StoredReviewedCommand
): Promise<ExecuteResult | null> {
  const pointer = pointerSchema.safeParse(value)
  if (!pointer.success) return null
  const [row] = await getDb()
    .select()
    .from(pendingActions)
    .where(
      and(
        eq(pendingActions.id, pointer.data.proposalId),
        eq(pendingActions.userId, ownerId)
      )
    )
  if (!row) return refuseFrozenReview()
  const frozen = readFrozenReview(
    row.frozenReview,
    binding,
    ownerId,
    command,
    row.input
  )
  if (
    row.command !== command ||
    frozen.proposalId !== row.id ||
    frozen.inputHash !== hash
  )
    return refuseFrozenReview()
  if (row.status !== "pending")
    throw new CommandError(
      ERROR_CODES.CONFLICT,
      "This saved proposal is no longer waiting"
    )
  return {
    pending: true,
    pendingActionId: row.id,
    chatId: row.chatId,
    command: row.command,
    summary: row.summary,
    review: frozen.review,
    activityId: null,
    reversal: null,
  }
}

export async function consumeFrozenReservation(frozen: FrozenReview) {
  if (frozen.key === null) return
  const [row] = await getDb()
    .select()
    .from(idempotency)
    .where(
      and(
        eq(idempotency.userId, frozen.ownerId),
        eq(idempotency.key, frozen.key)
      )
    )
    .for("update")
  const pointer = pointerSchema.safeParse(row?.result)
  if (
    !row ||
    row.command !== frozen.command ||
    row.inputHash !== frozen.inputHash ||
    !pointer.success ||
    pointer.data.proposalId !== frozen.proposalId
  )
    return refuseFrozenReview()
  await getDb()
    .delete(idempotency)
    .where(
      and(
        eq(idempotency.userId, frozen.ownerId),
        eq(idempotency.key, frozen.key)
      )
    )
}

export async function checkReviewActor(actor: Actor) {
  const [owner] = await getDb()
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, actor.userId))
  if (!owner) return refuseFrozenReview()
  if (actor.type === "coach") {
    const [chat] = await getDb()
      .select({ id: chats.id })
      .from(chats)
      .where(and(eq(chats.id, actor.chatId), eq(chats.userId, actor.userId)))
    if (!chat) return refuseFrozenReview()
  }
}

export function publicProposal(row: typeof pendingActions.$inferSelect) {
  const { frozenReview: privateReview, ...publicRow } = row
  void privateReview
  return publicRow
}

export async function checkPreparationTask(
  lease: TaskLease,
  actor: Actor,
  key: string | undefined
) {
  const [task] = await getDb()
    .select()
    .from(coachTasks)
    .where(
      and(
        eq(coachTasks.id, lease.taskId),
        eq(coachTasks.leaseOwner, lease.workerId),
        eq(coachTasks.leaseEpoch, lease.epoch),
        eq(coachTasks.state, "running"),
        sql`${coachTasks.cancelRequestedAt} is null`,
        sql`${coachTasks.leaseUntil} > clock_timestamp()`,
        sql`${coachTasks.deadlineAt} > clock_timestamp()`
      )
    )
  if (
    !task ||
    actor.type !== "coach" ||
    actor.userId !== task.ownerId ||
    actor.chatId !== task.chatId
  )
    throw new CommandError(ERROR_CODES.CONFLICT, "Task actor or lease mismatch")
  if (!key?.startsWith(`coach:${task.id}:`))
    throw new CommandError(ERROR_CODES.CONFLICT, "Task key mismatch")
}

export async function publishFrozenReview({
  binding,
  frozen,
  input,
  actor,
  key,
  hash,
  summary,
  approved,
  effect,
}: {
  binding: StoredReviewedCommand
  frozen: FrozenReview
  input: unknown
  actor: Actor
  key: string | undefined
  hash: string | null
  summary: string
  approved: boolean
  effect: () => Promise<ExecuteResult>
}): Promise<ExecuteResult> {
  await checkReviewActor(actor)
  if (actor.type === "delegate") await requireLiveDelegate(actor)
  if (key) {
    await reserveFrozenReview(frozen)
    const committed = await activityByKey(actor.userId, key)
    if (committed) {
      if (committed.command !== frozen.command || committed.inputHash !== hash)
        return refuseFrozenReview()
      await getDb()
        .delete(idempotency)
        .where(
          and(eq(idempotency.userId, actor.userId), eq(idempotency.key, key))
        )
      return { ...replay(committed), command: committed.command }
    }
  }
  await binding.revalidate(input, frozen, actor)
  if (actor.type !== "person" && !approved) {
    return createProposal({
      actor,
      command: frozen.command,
      input,
      summary,
      basisRevision: null,
      frozenReview: frozen,
    })
  }
  if (key)
    await getDb()
      .delete(idempotency)
      .where(
        and(eq(idempotency.userId, actor.userId), eq(idempotency.key, key))
      )
  return effect()
}
