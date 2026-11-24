import { ERROR_CODES, isCoachActor, type Actor } from "@workspace/domain"
import { getDb, savepoint } from "../db/context.js"
import { activity, idempotency } from "../db/schema.js"
import { createId } from "../platform/id.js"
import { CommandError, isUniqueViolation } from "../platform/errors.js"
import {
  replayFrozenProposal,
  type StoredReviewedCommand,
} from "./frozen-review.js"
import { activityByKey, idempotencyByKey } from "./registry-reads.js"
import { replay, replayStored } from "./replay.js"
import type {
  ExecuteResult,
  RanCommand,
  StoredCommand,
} from "./registry-types.js"

export async function recordCommandResult({
  command,
  actor,
  ran,
  key,
  hash,
  skipActivity,
}: {
  command: StoredCommand
  actor: Actor
  ran: RanCommand
  key: string | undefined
  hash: string | null
  skipActivity: boolean | undefined
}): Promise<ExecuteResult> {
  let activityId: string | null = null
  if (ran.draft && !skipActivity) {
    activityId = createId()
    await getDb()
      .insert(activity)
      .values({
        id: activityId,
        userId: actor.userId,
        actor: actor.type,
        command: command.name,
        subjectKind: ran.draft.subjectKind,
        subjectId: ran.draft.subjectId,
        summary:
          actor.type === "delegate"
            ? `${ran.draft.summary} (unverified agent connection: ${actor.name})`
            : ran.draft.summary,
        detail: ran.draft.detail ?? null,
        result: ran.output ?? null,
        reversalCommand: ran.reversal?.command ?? null,
        reversalInput: ran.reversal?.input ?? null,
        reversalExpect: ran.reversal?.expect ?? null,
        idempotencyKey: key ?? null,
        inputHash: hash,
        turnId: isCoachActor(actor) ? (actor.turnId ?? null) : null,
      })
  } else if (key) {
    await getDb()
      .insert(idempotency)
      .values({
        userId: actor.userId,
        key,
        inputHash: hash,
        command: command.name,
        result: ran.output ?? null,
      })
  }
  return {
    pending: false,
    output: ran.output,
    activityId,
    summary: ran.step,
    reversal: ran.reversal,
    detail: ran.draft?.detail,
  }
}

export async function replayByKey(
  commands: ReadonlyMap<string, StoredCommand>,
  reviewedFor: (
    command: StoredCommand,
    input: unknown
  ) => StoredReviewedCommand | undefined,
  userId: string,
  key: string,
  command: string,
  hash: string,
  input: unknown
) {
  const existing = await activityByKey(userId, key)
  const stored = existing ?? (await idempotencyByKey(userId, key))
  if (!stored) return null
  if (
    stored.command !== command ||
    (stored.inputHash !== null && stored.inputHash !== hash)
  )
    throw new CommandError(
      ERROR_CODES.CONFLICT,
      "Idempotency key does not match its command and input"
    )
  const entry = commands.get(command)
  const reviewed = entry ? reviewedFor(entry, input) : undefined
  if (!existing && entry?.reviewed) {
    const proposal = await replayFrozenProposal(
      stored.result,
      userId,
      command,
      hash,
      reviewed
    )
    if (proposal) return proposal
  }
  return {
    ...(existing ? replay(existing) : replayStored(stored.result)),
    command: stored.command,
    ...(stored.inputHash === null
      ? { touches: [{ ownerId: userId, name: "workspace" }] }
      : {}),
  }
}

export async function prepareOutside(
  command: StoredCommand,
  parsed: unknown,
  actor: Actor,
  key: string | undefined,
  hash: string | null,
  replay: (
    userId: string,
    key: string,
    name: string,
    hash: string,
    input: unknown
  ) => Promise<ExecuteResult | null>
): Promise<ExecuteResult | { ahead: unknown }> {
  if (!command.prepare) return { ahead: undefined }
  if (key && hash) {
    const earlier = await replay(actor.userId, key, command.name, hash, parsed)
    if (earlier) return earlier
  }
  return { ahead: await command.prepare(parsed, actor) }
}

export async function finishIdempotent(
  key: string | undefined,
  publish: () => Promise<ExecuteResult>,
  replay: () => Promise<ExecuteResult | null>
) {
  if (!key) return publish()
  try {
    return await savepoint(publish)
  } catch (error) {
    if (!isUniqueViolation(error)) throw error
    const winner = await replay()
    if (!winner) throw error
    return winner
  }
}
