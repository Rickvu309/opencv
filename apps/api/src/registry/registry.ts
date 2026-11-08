import {
  coachRefusal,
  type AgentGates,
  REFUSAL_MESSAGES,
  omitStoredKeySoTheCommandsOwnWriteStaysReplaySafe,
} from "./coach-policy.js"
export { coachRefusal }
import { executeTaskCommand, type TaskLease } from "./task-fence.js"
import {
  ERROR_CODES,
  effectiveCoachPolicy,
  approvedProposalActor,
  coachActor,
  isCoachActor,
  personActor,
  type Actor,
} from "@workspace/domain"
import { and, eq } from "drizzle-orm"

import { activity, idempotency, pendingActions } from "../db/schema.js"
import { getDb, savepoint, transaction } from "../db/context.js"
import {
  PENDING_TTL_MS,
  createProposal,
  lockProposal,
  expireIfStale,
  expireTaskApprovals,
  assertTaskReceipt,
} from "./proposals.js"
import {
  delegateAllowed,
  requireLiveDelegate,
  requireLiveProposalConnection,
} from "./delegate-policy.js"
import { createId } from "../id.js"
import { CommandError, isUniqueViolation } from "./errors.js"

import { lockActivity } from "./activity-lock.js"
import {
  activityById,
  activityByKey,
  agentGates,
  idempotencyByKey,
} from "./registry-reads.js"
import { brandedActor, parseInput } from "./parse-input.js"
import {
  laterLiveAction,
  staleExpectation,
  undoKeyFor,
  undoOfUndo,
} from "./expectation.js"
import { replay, replayStored } from "./replay.js"
import { inputHash } from "./receipt.js"
import { assertReversal } from "./bind.js"
import { RegistryEntries } from "./registry-entries.js"
import { priorityRevisionFor } from "../job/index.js"
import { withGrantScope } from "./write-grant.js"
import {
  checkPreparationTask,
  checkReviewActor,
  consumeFrozenReservation,
  prepareOrReplay,
  publishFrozenReview,
  publicProposal,
  readFrozenReview,
  refuseFrozenReview,
  replayFrozenProposal,
  requirePreparationBoundary,
  reviewReceiptKey,
  type FrozenReview,
} from "./frozen-review.js"

import type {
  ExecuteResult,
  ExecuteOptions,
  TaskOptions,
  UndoCandidate,
  ToolEntry,
  UndoGuard,
} from "./registry-types.js"
export type { AgentGates, ExecuteResult, ToolEntry }

function jsonInput(input: unknown): unknown {
  return JSON.parse(JSON.stringify(input))
}

const taskExecution = Symbol("taskExecution")
const approvedDelegate = Symbol("approvedDelegate")
const frozenExecution = Symbol("frozenExecution")
const preparingTask = Symbol("preparingTask")
const approvingReview = Symbol("approvingReview")

export class Registry extends RegistryEntries {
  private readonly undoGuards = new Map<string, UndoGuard>()

  addUndoGuard(reversalCommand: string, guard: UndoGuard) {
    this.undoGuards.set(reversalCommand, guard)
  }

  async undoBlockedReasons(
    userId: string,
    items: readonly UndoCandidate[]
  ): Promise<(string | null)[]> {
    const reasons: (string | null)[] = items.map(() => null)
    const byCommand = new Map<string, number[]>()
    items.forEach((item, index) => {
      if (item.command && this.undoGuards.has(item.command)) {
        byCommand.set(item.command, [
          ...(byCommand.get(item.command) ?? []),
          index,
        ])
      }
    })
    for (const [command, indexes] of byCommand) {
      try {
        const answers = await this.undoGuards.get(command)!(
          userId,
          indexes.map((index) => ({
            input: items[index]!.input,
            source: items[index]!.source ?? null,
          }))
        )
        indexes.forEach((index, at) => {
          reasons[index] = answers[at] ?? null
        })
      } catch {
        for (const index of indexes) reasons[index] = "Undo is not available"
      }
    }
    for (const [index, item] of items.entries()) {
      if (item.command && !reasons[index] && item.expect) {
        reasons[index] = await staleExpectation(
          (query, input) => this.read(query, input, personActor(userId)),
          item.expect
        )
      }
    }
    return reasons
  }

  async undoBlockedReason(
    userId: string,
    command: string | null,
    input: unknown
  ) {
    return (await this.undoBlockedReasons(userId, [{ command, input }]))[0]!
  }

  executeTask(lease: TaskLease, options: TaskOptions) {
    const command = this.commands.get(options.name)
    if (command?.reviewed)
      return this.execute({ ...options, [preparingTask]: lease })
    return executeTaskCommand(lease, { ...options }, command, (input) => {
      if (command)
        input.input = jsonInput(parseInput(command.input, input.input))
      return this.execute({ ...options, [taskExecution]: true })
    })
  }

  async execute(
    options: ExecuteOptions & {
      expectedRevision?: number | null
      [taskExecution]?: boolean
      [approvedDelegate]?: string
      [frozenExecution]?: FrozenReview
      [preparingTask]?: TaskLease
      [approvingReview]?: boolean
    }
  ): Promise<ExecuteResult> {
    if (
      options.idempotencyKey?.startsWith("coach:") &&
      !options[taskExecution] &&
      !options[preparingTask]
    )
      throw new CommandError(
        ERROR_CODES.CONFLICT,
        "The coach: key namespace is reserved for durable tasks"
      )
    const command = this.commands.get(options.name)
    if (!command) {
      throw new CommandError(ERROR_CODES.UNKNOWN_COMMAND, "Unknown command")
    }
    const actor = brandedActor(options.actor)
    if (!delegateAllowed(command, actor))
      throw new CommandError(
        ERROR_CODES.FORBIDDEN,
        "This connection cannot use this command"
      )
    const parsed = parseInput(command.input, options.input)
    const policy = effectiveCoachPolicy(command, parsed)
    if (actor.type === "delegate" && policy === "never")
      throw new CommandError(
        ERROR_CODES.FORBIDDEN,
        "This resource cannot be changed by an agent"
      )
    if (isCoachActor(actor)) {
      const refusal = coachRefusal(
        { ...command, coach: policy },
        await agentGates(actor.userId)
      )
      if (refusal) {
        throw new CommandError(
          ERROR_CODES.COACH_NOT_ALLOWED,
          REFUSAL_MESSAGES[refusal]
        )
      }
    }
    const idempotencyKey = omitStoredKeySoTheCommandsOwnWriteStaysReplaySafe(
      command,
      options.idempotencyKey
    )

    const hash = idempotencyKey ? inputHash(jsonInput(parsed)) : null
    const reviewed = command.reviewed
    if (reviewed && !options[frozenExecution]) {
      requirePreparationBoundary()
      await checkReviewActor(actor)
      if (actor.type === "delegate") await requireLiveDelegate(actor)
      const lease = options[preparingTask]
      if (lease) await checkPreparationTask(lease, actor, idempotencyKey)
      const { earlier, frozen } = await prepareOrReplay(
        reviewed,
        jsonInput(parsed),
        actor,
        command.name,
        idempotencyKey,
        this.replayByKey.bind(this)
      )
      const publish = async () =>
        earlier ??
        this.execute({
          ...options,
          [frozenExecution]: frozen!,
          [taskExecution]: Boolean(lease),
        })
      const result = lease
        ? await executeTaskCommand(
            lease,
            {
              ...options,
              input: jsonInput(parsed),
              idempotencyKey: idempotencyKey!,
            },
            command,
            publish
          )
        : await publish()
      return result.pending
        ? result
        : this.committedResult(
            command.name,
            parsed as never,
            actor.userId,
            result
          )
    }
    const frozen = reviewed
      ? readFrozenReview(
          options[frozenExecution],
          reviewed,
          actor.userId,
          command.name,
          parsed
        )
      : null
    const effect = async (): Promise<ExecuteResult> => {
      const ran = await withGrantScope(
        {
          ownerId: actor.userId,
          writes: command.writes?.(parsed) ?? [],
          expectedRevision: options.expectedRevision ?? null,
        },
        async () => {
          if (!reviewed || !frozen) return command.run(parsed, actor)
          await reviewed.revalidate(parsed, frozen, actor)
          return reviewed.run(parsed, frozen, actor)
        }
      )
      assertReversal(command.name, this.isCatalogOperation(command.name), ran)
      let activityId: string | null = null
      if (ran.draft && !options.skipActivity) {
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
                ? `${ran.draft.summary} · an agent connection (${actor.name}, unverified)`
                : ran.draft.summary,
            detail: ran.draft.detail ?? null,
            result: ran.output ?? null,
            reversalCommand: ran.reversal?.command ?? null,
            reversalInput: ran.reversal?.input ?? null,
            reversalExpect: ran.reversal?.expect ?? null,
            idempotencyKey: idempotencyKey ?? null,
            inputHash: hash,
            turnId: isCoachActor(actor) ? (actor.turnId ?? null) : null,
          })
      } else if (idempotencyKey) {
        await getDb()
          .insert(idempotency)
          .values({
            userId: actor.userId,
            key: idempotencyKey,
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

    const run = async () => {
      if (idempotencyKey) {
        const earlier = await this.replayByKey(
          actor.userId,
          idempotencyKey,
          command.name,
          hash!
        )
        if (earlier) return earlier
      }

      let publish = effect
      if (reviewed && frozen) {
        publish = () =>
          publishFrozenReview({
            binding: reviewed,
            frozen,
            input: parsed,
            actor,
            key: idempotencyKey,
            hash,
            summary: command.step(parsed),
            approved: Boolean(options[approvingReview]),
            effect,
          })
      } else if (
        (actor.type === "delegate" &&
          (!options[approvedDelegate] ||
            options[approvedDelegate] !== options.idempotencyKey)) ||
        (isCoachActor(actor) && policy === "confirm" && !options.skipConfirm)
      ) {
        return createProposal({
          actor,
          command: command.name,
          input: parsed,
          summary: command.step(parsed),
          basisRevision: await priorityRevisionFor(
            actor.userId,
            command.writes?.(parsed) ?? []
          ),
        })
      }

      if (!idempotencyKey) return publish()
      try {
        return await savepoint(publish)
      } catch (error) {
        if (!isUniqueViolation(error)) throw error
        const winner = await this.replayByKey(
          actor.userId,
          idempotencyKey,
          command.name,
          hash!
        )
        if (!winner) throw error
        return winner
      }
    }
    const result =
      command.transaction === "none" ? await run() : await transaction(run)
    if (result.pending) return result
    return this.committedResult(
      result.command ?? command.name,
      parsed as never,
      actor.userId,
      result
    )
  }

  async read(name: string, input: unknown, actor: Actor) {
    const query = this.queries.get(name)
    if (!query) {
      throw new CommandError(ERROR_CODES.UNKNOWN_COMMAND, "Unknown query")
    }
    const branded = brandedActor(actor)
    if (!delegateAllowed(query, branded))
      throw new CommandError(
        ERROR_CODES.FORBIDDEN,
        "This connection cannot use this read"
      )
    if (isCoachActor(branded)) {
      const refusal = coachRefusal(query, await agentGates(branded.userId))
      if (refusal) {
        throw new CommandError(
          ERROR_CODES.COACH_NOT_ALLOWED,
          REFUSAL_MESSAGES[refusal]
        )
      }
    }
    return query.read(input, branded)
  }

  async confirmations(userId: string, chatId: string) {
    const rows = await getDb()
      .select()
      .from(pendingActions)
      .where(
        and(
          eq(pendingActions.userId, userId),
          eq(pendingActions.chatId, chatId)
        )
      )
    return Promise.all(
      rows.map(async (row) => {
        const completed =
          row.status === "approved"
            ? await activityByKey(userId, reviewReceiptKey(row))
            : null
        return {
          id: row.id,
          status:
            row.status === "pending" &&
            Date.now() - row.createdAt.getTime() > PENDING_TTL_MS
              ? ("expired" as const)
              : row.status,
          receipt: this.confirmationReceipt(completed),
        }
      })
    )
  }

  async approve(userId: string, pendingActionId: string) {
    await expireIfStale(userId, pendingActionId)
    return transaction(async () => {
      const { row, task } = await lockProposal(userId, pendingActionId)
      if (row.status === "approved") {
        if (task) await assertTaskReceipt(userId, row)
        return activityByKey(userId, reviewReceiptKey(row)).then((receipt) =>
          receipt ? this.publicActivity(receipt) : null
        )
      }
      if (row.status === "expired") {
        throw new CommandError(
          ERROR_CODES.PENDING_EXPIRED,
          "This confirmation expired. Ask the Coach again."
        )
      }
      if (row.status === "denied") {
        throw new CommandError(
          ERROR_CODES.CONFLICT,
          "This action was already declined."
        )
      }
      const delegate = row.delegateConnectionId
        ? await requireLiveProposalConnection(userId, row.delegateConnectionId)
        : null
      const stored = this.commands.get(row.command)
      const frozen = stored?.reviewed
        ? readFrozenReview(
            row.frozenReview,
            stored.reviewed,
            userId,
            row.command,
            row.input
          )
        : null
      if (
        (row.frozenReview != null && !frozen) ||
        (frozen && frozen.proposalId !== row.id)
      )
        return refuseFrozenReview()
      if (frozen) await consumeFrozenReservation(frozen)
      const checksPriority = (stored?.writes?.(row.input) ?? []).some(
        (write) => write.name === "job.priority"
      )
      if (checksPriority && row.basisRevision === null)
        throw new CommandError(
          ERROR_CODES.CONFLICT,
          "This confirmation has no priority version, so nothing was changed"
        )
      const result = await this.execute({
        name: row.command,
        input: row.input,
        actor:
          delegate ??
          (task
            ? coachActor(task.task.ownerId, task.task.chatId, task.turnId)
            : approvedProposalActor(userId, row.chatId)),
        [approvedDelegate]: row.id,
        idempotencyKey: reviewReceiptKey(row),
        ...(frozen
          ? { [frozenExecution]: frozen, [approvingReview]: true }
          : {}),
        [taskExecution]: Boolean(task),
        skipConfirm: true,
        expectedRevision: checksPriority ? row.basisRevision : null,
      })
      await getDb()
        .update(pendingActions)
        .set({ status: "approved" })
        .where(eq(pendingActions.id, row.id))
      if (task) {
        const { resolveTaskApproval } = await import("../coach/index.js")
        await assertTaskReceipt(userId, row)
        await resolveTaskApproval(task, "committed", result, result.activityId)
      }
      if (result.activityId)
        return activityById(userId, result.activityId).then((receipt) =>
          receipt ? this.publicActivity(receipt) : null
        )
      return activityByKey(userId, reviewReceiptKey(row)).then((receipt) =>
        receipt ? this.publicActivity(receipt) : null
      )
    })
  }

  async deny(userId: string, pendingActionId: string) {
    await expireIfStale(userId, pendingActionId)
    return transaction(async () => {
      const { row, task } = await lockProposal(userId, pendingActionId)
      if (row.status === "denied") return publicProposal(row)
      if (row.status === "expired") {
        throw new CommandError(
          ERROR_CODES.PENDING_EXPIRED,
          "This confirmation expired. Ask the Coach again."
        )
      }
      if (row.status !== "pending") {
        throw new CommandError(
          ERROR_CODES.CONFLICT,
          "This action is no longer waiting."
        )
      }
      await getDb()
        .update(pendingActions)
        .set({ status: "denied" })
        .where(eq(pendingActions.id, row.id))
      if (task) {
        const { resolveTaskApproval } = await import("../coach/index.js")
        await resolveTaskApproval(task, "denied", { denied: true })
      }
      return { ...publicProposal(row), status: "denied" as const }
    })
  }

  async undo(userId: string, activityId: string) {
    return transaction(async () => {
      const row = await lockActivity(userId, activityId)
      if (row.undoneAt) {
        throw new CommandError(
          ERROR_CODES.CONFLICT,
          "This action was already undone."
        )
      }
      if (!row.reversalCommand) {
        throw new CommandError(
          ERROR_CODES.CONFLICT,
          "This action cannot be undone."
        )
      }
      const [stale] = await this.undoBlockedReasons(userId, [
        {
          command: row.reversalCommand,
          input: row.reversalInput,
          expect: row.reversalExpect,
          source: row.command,
        },
      ])
      const blocked = undoOfUndo(row) ?? stale ?? (await laterLiveAction(row))
      if (blocked) throw new CommandError(ERROR_CODES.CONFLICT, blocked)
      await this.execute({
        name: row.reversalCommand,
        input: row.reversalInput,
        actor: personActor(userId),
        idempotencyKey: undoKeyFor(row.id),
        skipConfirm: true,
        skipActivity: row.reversalCommand === "paper.attachPhoto",
      })
      const undoneAt = new Date()
      await getDb()
        .update(activity)
        .set({ undoneAt })
        .where(eq(activity.id, row.id))
      return this.publicActivity({ ...row, undoneAt })
    })
  }

  expireTaskApprovals() {
    return expireTaskApprovals()
  }

  private async replayByKey(
    userId: string,
    key: string,
    command: string,
    hash: string
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
    const reviewed = this.commands.get(command)?.reviewed
    if (!existing && reviewed) {
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
}

export const registry = new Registry()
