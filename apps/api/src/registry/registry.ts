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
  approvedProposalActor,
  isCoachActor,
  personActor,
  type Actor,
} from "@workspace/domain/kernel"
import { and, eq } from "drizzle-orm"

import { activity, pendingActions } from "../db/schema.js"
import { getDb, transaction } from "../db/context.js"
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
import { paperAgentRefusal } from "./paper-agent.js"
import { CommandError } from "../platform/errors.js"

import { lockActivity } from "./activity-lock.js"
import { activityById, activityByKey, agentGates } from "./registry-reads.js"
import { brandedActor, parseInput } from "./parse-input.js"
import {
  laterLiveAction,
  staleExpectation,
  undoKeyFor,
  undoOfUndo,
} from "./expectation.js"
import { inputHash } from "./receipt.js"
import {
  finishIdempotent,
  prepareOutside,
  recordCommandResult,
  replayByKey as replayKeyedCommand,
} from "./command-execution.js"
import { assertReversal } from "./bind.js"
import { RegistryEntries } from "./registry-entries.js"
import { versionedWrite, withGrantScope } from "./write-grant.js"
import {
  checkPreparationTask,
  checkReviewActor,
  consumeFrozenReservation,
  prepareOrReplay,
  publishFrozenReview,
  publicProposal,
  readFrozenReview,
  refuseFrozenReview,
  requirePreparationBoundary,
  requirePublicationBoundary,
  reviewSnapshot,
  reviewReceiptKey,
  isUnchanged,
  readPreparedExecution,
  publishUnchanged,
  type LockedBasis,
  type PreparedExecution,
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
const approvingReview = Symbol("approvingReview")
const confirmed = Symbol("confirmed")
const noReceipt = Symbol("noReceipt")

type RunnerOptions = ExecuteOptions & {
  expectedRevision?: number | null
  [taskExecution]?: boolean
  [approvedDelegate]?: string
  [frozenExecution]?: PreparedExecution
  [approvingReview]?: boolean
  [confirmed]?: boolean
  [noReceipt]?: boolean
}

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

  async prepareTask(lease: TaskLease, options: TaskOptions) {
    requirePreparationBoundary()
    const ownedLease = reviewSnapshot(lease)
    const captured = reviewSnapshot(options)
    const { command, actor, parsed } = await this.admitCommand(captured)
    const reviewed = this.reviewedFor(command, parsed)
    if (!reviewed) return refuseFrozenReview()
    const bindingVersion = reviewed.version
    const normalized = reviewSnapshot({ ...captured, actor, input: parsed })
    await checkReviewActor(actor)
    await checkPreparationTask(ownedLease, actor, normalized.idempotencyKey)
    const { frozen } = await prepareOrReplay(
      reviewed,
      normalized.input,
      actor,
      command.name,
      normalized.idempotencyKey,
      this.replayByKey.bind(this)
    )
    return async () => {
      requirePublicationBoundary()
      return executeTaskCommand(ownedLease, normalized, command, async () => {
        const current = await this.admitCommand(normalized)
        if (
          this.reviewedFor(current.command, current.parsed)?.version !==
          bindingVersion
        )
          return refuseFrozenReview()
        await checkReviewActor(actor)
        const earlier = await this.replayByKey(
          actor.userId,
          normalized.idempotencyKey,
          command.name,
          inputHash(normalized.input),
          normalized.input
        )
        if (earlier)
          return earlier.pending
            ? earlier
            : this.committedResult(
                command.name,
                normalized.input as never,
                actor.userId,
                earlier
              )
        if (!frozen) return refuseFrozenReview()
        return this.execute({
          ...normalized,
          [frozenExecution]: frozen,
          [taskExecution]: true,
        })
      })
    }
  }

  async executeTask(lease: TaskLease, options: TaskOptions) {
    const command = this.commands.get(options.name)
    if (command && this.taskNeedsPreparation(options.name, options.input)) {
      const publish = await this.prepareTask(lease, options)
      return transaction(publish)
    }
    return executeTaskCommand(lease, { ...options }, command, (input) => {
      if (command)
        input.input = jsonInput(parseInput(command.input, input.input))
      return this.execute({ ...options, [taskExecution]: true })
    })
  }

  execute(options: RunnerOptions): Promise<ExecuteResult> {
    return this.#execute(options)
  }

  async #execute(options: RunnerOptions, undo = false): Promise<ExecuteResult> {
    if (options.idempotencyKey?.startsWith("coach:") && !options[taskExecution])
      throw new CommandError(
        ERROR_CODES.CONFLICT,
        "The coach: key namespace is reserved for durable tasks"
      )
    const { command, actor, parsed, policy } = await this.admitCommand(
      options,
      undo
    )
    const idempotencyKey = omitStoredKeySoTheCommandsOwnWriteStaysReplaySafe(
      command,
      options.idempotencyKey
    )

    const hash = idempotencyKey ? inputHash(jsonInput(parsed)) : null
    const reviewed = this.reviewedFor(command, parsed)
    if (options[frozenExecution] && !reviewed) return refuseFrozenReview()
    if (reviewed && !options[frozenExecution]) {
      requirePreparationBoundary()
      await checkReviewActor(actor)
      if (actor.type === "delegate") await requireLiveDelegate(actor)
      const { earlier, frozen } = await prepareOrReplay(
        reviewed,
        jsonInput(parsed),
        actor,
        command.name,
        idempotencyKey,
        this.replayByKey.bind(this)
      )
      const result =
        earlier ??
        (await this.execute({
          ...options,
          [frozenExecution]: frozen!,
        }))
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
      ? readPreparedExecution(
          options[frozenExecution],
          reviewed,
          actor.userId,
          command.name,
          parsed
        )
      : null
    let ahead: unknown
    const effect = async (locked?: LockedBasis): Promise<ExecuteResult> => {
      const ran =
        frozen && isUnchanged(frozen)
          ? {
              output: frozen.output,
              draft: null,
              reversal: null,
              step: command.step(parsed),
            }
          : await withGrantScope(
              {
                ownerId: actor.userId,
                writes: command.writes?.(parsed) ?? [],
                expectedRevision: options.expectedRevision ?? null,
              },
              async () => {
                if (!reviewed || !frozen)
                  return command.run(parsed, actor, ahead)
                if (isUnchanged(frozen)) return refuseFrozenReview()
                if (!locked) return refuseFrozenReview()
                return reviewed.run(parsed, frozen, actor, locked)
              }
            )
      assertReversal(ran)
      return recordCommandResult({
        command,
        actor,
        ran,
        key: idempotencyKey,
        hash,
        skipActivity: options[noReceipt],
      })
    }

    const run = async () => {
      if (idempotencyKey) {
        const earlier = await this.replayByKey(
          actor.userId,
          idempotencyKey,
          command.name,
          hash!,
          parsed
        )
        if (earlier) return earlier
      }

      let publish = effect
      if (
        reviewed &&
        frozen &&
        this.reviewedFor(command, parsed)?.version !== frozen.bindingVersion
      )
        return refuseFrozenReview()
      if (reviewed && frozen && isUnchanged(frozen)) {
        await checkReviewActor(actor)
        if (actor.type === "delegate") await requireLiveDelegate(actor)
        if (!reviewed.unchanged) return refuseFrozenReview()
        await publishUnchanged(reviewed, frozen, parsed, actor)
      } else if (reviewed && frozen && !isUnchanged(frozen)) {
        publish = () =>
          publishFrozenReview({
            binding: reviewed,
            frozen,
            input: parsed,
            actor,
            key: idempotencyKey,
            hash,
            summary: command.step(parsed),
            approved: !!options[approvingReview],
            effect,
          })
      } else if (
        (actor.type === "delegate" &&
          (!options[approvedDelegate] ||
            options[approvedDelegate] !== options.idempotencyKey)) ||
        (isCoachActor(actor) && policy === "confirm" && !options[confirmed])
      ) {
        return createProposal({
          actor,
          command: command.name,
          input: parsed,
          summary: command.step(parsed),
          basisRevision: (await command.basis?.(parsed, actor)) ?? null,
          read: (query, input) =>
            this.read(query, input, personActor(actor.userId)),
        })
      }

      return finishIdempotent(idempotencyKey, publish, () =>
        this.replayByKey(
          actor.userId,
          idempotencyKey!,
          command.name,
          hash!,
          parsed
        )
      )
    }
    const hit = command.prepare
      ? await prepareOutside(
          command,
          parsed,
          actor,
          idempotencyKey,
          hash,
          this.replayByKey.bind(this)
        )
      : null
    if (hit && "ahead" in hit) ahead = hit.ahead
    const result =
      hit && !("ahead" in hit)
        ? hit
        : command.transaction === "none" && !command.prepare
          ? await run()
          : await transaction(run)
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
        paperAgentRefusal(query.name) ?? "This connection cannot use this read"
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
      const stored = this.commands.get(row.command)
      const delegate = row.delegateConnectionId
        ? await requireLiveProposalConnection(
            userId,
            row.delegateConnectionId,
            stored?.delegate
          )
        : null
      if (stored?.undoOnly) return refuseFrozenReview()
      const reviewed = stored
        ? this.reviewedFor(stored, parseInput(stored.input, row.input))
        : undefined
      const frozen = reviewed
        ? readFrozenReview(
            row.frozenReview,
            reviewed,
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
      const versioned = versionedWrite(stored?.writes?.(row.input) ?? [])
      if (versioned && row.basisRevision === null)
        throw new CommandError(
          ERROR_CODES.CONFLICT,
          `This confirmation has no ${versioned.field} version, so nothing was changed`
        )
      const result = await this.execute({
        name: row.command,
        input: row.input,
        actor:
          delegate ??
          (task ? task.actor : approvedProposalActor(userId, row.chatId)),
        [approvedDelegate]: row.id,
        idempotencyKey: reviewReceiptKey(row),
        ...(frozen
          ? { [frozenExecution]: frozen, [approvingReview]: true }
          : {}),
        [taskExecution]: !!task,
        [confirmed]: true,
        expectedRevision: versioned ? row.basisRevision : null,
      })
      await getDb()
        .update(pendingActions)
        .set({ status: "approved" })
        .where(eq(pendingActions.id, row.id))
      if (task) {
        await assertTaskReceipt(userId, row)
        await task.resolve("committed", result, result.activityId)
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
        await task.resolve("denied", { denied: true })
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
      await this.#execute(
        {
          name: row.reversalCommand,
          input: row.reversalInput,
          actor: personActor(userId),
          idempotencyKey: undoKeyFor(row.id),
          [confirmed]: true,
        },
        true
      )
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
    hash: string,
    input: unknown
  ) {
    const replayed = await replayKeyedCommand(
      this.commands,
      (entry, value) => this.reviewedFor(entry, value),
      userId,
      key,
      command,
      hash,
      input
    )
    if (
      replayed &&
      !replayed.pending &&
      !this.fitsPublicShape(command, replayed.output)
    )
      throw new CommandError(
        ERROR_CODES.CONFLICT,
        "Idempotency key does not match its command and input"
      )
    return replayed
  }
}

export const registry = new Registry()
