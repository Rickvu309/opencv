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
  approvalReceiptKey,
  createProposal,
  publicProposal,
  lockProposal,
  expireIfStale,
  expireTaskApprovals,
  assertTaskReceipt,
} from "./proposals.js"
import {
  delegateAllowed,
  requireLiveProposalConnection,
} from "./delegate-policy.js"
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
const confirmed = Symbol("confirmed")
const noReceipt = Symbol("noReceipt")

type RunnerOptions = ExecuteOptions & {
  expectedRevision?: number | null
  [taskExecution]?: boolean
  [approvedDelegate]?: string
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

  async executeTask(lease: TaskLease, options: TaskOptions) {
    const command = this.commands.get(options.name)
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
    let ahead: unknown
    const effect = async (): Promise<ExecuteResult> => {
      const ran = await withGrantScope(
        {
          ownerId: actor.userId,
          writes: command.writes?.(parsed) ?? [],
          expectedRevision: options.expectedRevision ?? null,
        },
        () => command.run(parsed, actor, ahead)
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
          hash!
        )
        if (earlier) return earlier
      }

      if (
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

      return finishIdempotent(idempotencyKey, effect, () =>
        this.replayByKey(actor.userId, idempotencyKey!, command.name, hash!)
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
        this.delegateRefusalOf(query.name) ??
          "This connection cannot use this read"
      )
    if (isCoachActor(branded)) {
      const refusal = coachRefusal(
        { coach: query.coach, permission: this.coachPermissionOf(query.name) },
        await agentGates(branded.userId)
      )
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
            ? await activityByKey(userId, approvalReceiptKey(row))
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
        return activityByKey(userId, approvalReceiptKey(row)).then((receipt) =>
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
      if (stored?.undoOnly)
        throw new CommandError(
          ERROR_CODES.CONFLICT,
          "An Undo cannot be approved as a proposal"
        )
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
        idempotencyKey: approvalReceiptKey(row),
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
      return activityByKey(userId, approvalReceiptKey(row)).then((receipt) =>
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
    hash: string
  ) {
    const replayed = await replayKeyedCommand(userId, key, command, hash)
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
