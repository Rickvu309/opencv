import { ERROR_CODES, type Actor } from "@workspace/domain"
import { z, type ZodType } from "zod"
import { and, eq, sql, type AnyColumn, type SQL } from "drizzle-orm"
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

export type PreparedUnchanged<S, O> = Readonly<{
  kind: "unchanged"
  snapshot: S
  output: O
}>

export type BasisValue = {
  column: AnyColumn
  source: "snapshot" | "input" | "actor" | "candidate" | "review"
  field: string
}

export type RowBasis = {
  table: AnyColumn["table"]
  key: readonly [BasisValue, ...BasisValue[]]
  compared: readonly [BasisValue, ...BasisValue[]]
}

export type LockedBasis = Readonly<{
  key: readonly unknown[]
  compared: readonly unknown[]
}>

export type ReviewedCommand<I, O, C, V, S = never> = {
  version: string
  candidate: ZodType<C>
  review: ZodType<V>
  unchanged?: {
    snapshot: ZodType<S>
    basis: RowBasis
    revalidate: (input: I, snapshot: S, actor: Actor) => Promise<void>
  }
  basis: RowBasis
  prepare: (
    input: I,
    actor: Actor
  ) => Promise<PreparedReview<C, V> | PreparedUnchanged<S, O>>
  revalidate: (
    input: I,
    prepared: PreparedReview<C, V>,
    actor: Actor
  ) => Promise<void>
  commit: (
    input: I,
    prepared: PreparedReview<C, V>,
    actor: Actor,
    locked: LockedBasis
  ) => Promise<O>
}

export type StoredReviewedCommand = {
  version: string
  unchanged?: {
    parse: (snapshot: unknown) => unknown
    basis: RowBasis
    revalidate: (
      input: unknown,
      snapshot: unknown,
      actor: Actor
    ) => Promise<void>
  }
  basis: RowBasis
  parse: (
    value:
      PreparedReview<unknown, unknown> | PreparedUnchanged<unknown, unknown>
  ) => PreparedReview<unknown, unknown> | PreparedUnchanged<unknown, unknown>
  prepare: (
    input: unknown,
    actor: Actor
  ) => Promise<
    PreparedReview<unknown, unknown> | PreparedUnchanged<unknown, unknown>
  >
  revalidate: (
    input: unknown,
    prepared: PreparedReview<unknown, unknown>,
    actor: Actor
  ) => Promise<void>
  run: (
    input: unknown,
    prepared: PreparedReview<unknown, unknown>,
    actor: Actor,
    locked: LockedBasis
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

const unchangedSchema = envelopeSchema
  .omit({ proposalId: true, candidate: true, review: true })
  .extend({
    kind: z.literal("unchanged"),
    snapshot: z.unknown(),
    output: z.unknown(),
  })

export type FrozenUnchanged = z.infer<typeof unchangedSchema>
export type PreparedExecution = FrozenReview | FrozenUnchanged

export function isUnchanged(value: PreparedExecution): value is FrozenUnchanged
export function isUnchanged<S, O>(
  value: PreparedReview<unknown, unknown> | PreparedUnchanged<S, O>
): value is PreparedUnchanged<S, O>
export function isUnchanged(
  value: PreparedReview<unknown, unknown> | PreparedUnchanged<unknown, unknown>
): value is PreparedUnchanged<unknown, unknown> {
  return (
    "kind" in value &&
    value.kind === "unchanged" &&
    !("candidate" in value) &&
    !("review" in value)
  )
}

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

export function reviewSnapshot<T>(value: T): T {
  return immutable(clone(value))
}

export function refuseFrozenReview(): never {
  throw new CommandError(
    ERROR_CODES.CONFLICT,
    "The saved review no longer matches this edit"
  )
}

function basisValue(
  ref: BasisValue,
  bags: Readonly<Record<BasisValue["source"], unknown>>
) {
  const bag = bags[ref.source]
  if (!bag || typeof bag !== "object" || !Object.hasOwn(bag, ref.field))
    throw new CommandError(
      ERROR_CODES.CONFLICT,
      "The unchanged basis row does not match"
    )
  return (bag as Record<string, unknown>)[ref.field]
}

export async function lockBasis(
  basis: RowBasis,
  bags: Readonly<Record<BasisValue["source"], unknown>>
): Promise<LockedBasis> {
  const refs = [...basis.key, ...basis.compared]
  if (refs.some((ref) => ref.column.table !== basis.table))
    throw new CommandError(
      ERROR_CODES.CONFLICT,
      "The unchanged basis row does not match"
    )
  const names = refs.map((ref) => ref.column.name)
  if (new Set(names).size !== names.length)
    throw new CommandError(
      ERROR_CODES.CONFLICT,
      "The unchanged basis row does not match"
    )
  const expectedKey = basis.key.map((ref) => basisValue(ref, bags))
  const expectedCompared = basis.compared.map((ref) => basisValue(ref, bags))
  const selection: Record<string, AnyColumn> = {}
  for (const ref of refs) selection[ref.column.name] = ref.column
  const clauses = basis.key.map((ref, index) =>
    eq(ref.column, expectedKey[index] as never)
  )
  const where = clauses.length === 1 ? clauses[0] : and(...clauses)
  const db = getDb() as unknown as {
    select: (columns: Record<string, AnyColumn>) => {
      from: (table: unknown) => {
        where: (clause: SQL | undefined) => {
          for: (mode: "update") => Promise<Array<Record<string, unknown>>>
        }
      }
    }
  }
  const [row] = await db
    .select(selection)
    .from(basis.table)
    .where(where)
    .for("update")
  if (!row)
    throw new CommandError(
      ERROR_CODES.CONFLICT,
      "The unchanged basis row is missing"
    )
  const readKey = basis.key.map((ref) => row[ref.column.name])
  const readCompared = basis.compared.map((ref) => row[ref.column.name])
  if (
    readKey.some((value, index) => value !== expectedKey[index]) ||
    readCompared.some((value, index) => value !== expectedCompared[index])
  )
    throw new CommandError(ERROR_CODES.CONFLICT, "Basis conflict")
  return Object.freeze({
    key: Object.freeze(readKey),
    compared: Object.freeze(readCompared),
  })
}

export async function publishUnchanged(
  binding: StoredReviewedCommand,
  frozen: FrozenUnchanged,
  input: unknown,
  actor: Actor
) {
  if (!binding.unchanged) return refuseFrozenReview()
  const snapshot = binding.unchanged.parse(frozen.snapshot)
  await lockBasis(binding.unchanged.basis, {
    snapshot,
    input,
    actor,
    candidate: null,
    review: null,
  })
  await binding.unchanged.revalidate(input, snapshot, actor)
}

export async function lockReviewedBasis(
  binding: StoredReviewedCommand,
  input: unknown,
  prepared: PreparedReview<unknown, unknown>,
  actor: Actor
) {
  const locked = await lockBasis(binding.basis, {
    snapshot: null,
    input,
    actor,
    candidate: prepared.candidate,
    review: prepared.review,
  })
  await binding.revalidate(input, prepared, actor)
  return locked
}

export function requirePreparationBoundary() {
  if (insideTransaction())
    throw new CommandError(
      ERROR_CODES.CONFLICT,
      "Review preparation must start before a transaction"
    )
}

export function requirePublicationBoundary() {
  if (!insideTransaction())
    throw new CommandError(
      ERROR_CODES.CONFLICT,
      "Prepared task publication requires its owning transaction"
    )
}

export async function prepareReview(
  binding: StoredReviewedCommand,
  input: unknown,
  actor: Actor,
  command: string,
  key: string | undefined
): Promise<PreparedExecution> {
  requirePreparationBoundary()
  const hash = inputHash(input)
  const prepared = clone(
    binding.parse(
      await binding.prepare(immutable(clone(input)), immutable(clone(actor)))
    )
  )
  const body = isUnchanged(prepared)
    ? {
        version: 1 as const,
        bindingVersion: binding.version,
        ownerId: actor.userId,
        command,
        inputHash: hash,
        key: key ?? null,
        ...prepared,
      }
    : {
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
    hash: string,
    input: unknown
  ) => Promise<ExecuteResult | null>
) {
  requirePreparationBoundary()
  const earlier = key
    ? await replay(actor.userId, key, command, inputHash(input), input)
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
  if (isUnchanged(parsed)) return refuseFrozenReview()
  if (
    inputHash(parsed) !==
    inputHash({ candidate: body.candidate, review: body.review })
  )
    return refuseFrozenReview()
  return immutable(clone(checked.data))
}

export function readPreparedExecution(
  value: unknown,
  binding: StoredReviewedCommand,
  ownerId: string,
  command: string,
  input: unknown
): PreparedExecution {
  const checked = unchangedSchema.safeParse(value)
  if (!checked.success)
    return readFrozenReview(value, binding, ownerId, command, input)
  const { digest, ...body } = checked.data
  if (
    !binding.unchanged ||
    body.bindingVersion !== binding.version ||
    body.ownerId !== ownerId ||
    body.command !== command ||
    body.inputHash !== inputHash(input) ||
    digest !== inputHash(body) ||
    inputHash(binding.unchanged.parse(body.snapshot)) !==
      inputHash(body.snapshot)
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
  binding: StoredReviewedCommand | undefined
): Promise<ExecuteResult | null> {
  const pointer = pointerSchema.safeParse(value)
  if (!pointer.success) return null
  if (!binding) return refuseFrozenReview()
  const [row] = await getDb()
    .select()
    .from(pendingActions)
    .where(
      and(
        eq(pendingActions.id, pointer.data.proposalId),
        eq(pendingActions.userId, ownerId),
        sql`${pendingActions.createdAt} + interval '24 hours' > clock_timestamp()`
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
  effect: (locked: LockedBasis) => Promise<ExecuteResult>
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
  const locked = await lockReviewedBasis(binding, input, frozen, actor)
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
  return effect(locked)
}
