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
  defineCommand,
  isCoachActor,
  personActor,
  type Actor,
  type CommandSpec,
  type QuerySpec,
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
import { CatalogPublication } from "./catalog-publication.js"
import { priorityRevisionFor } from "../job/index.js"
import { withGrantScope } from "./write-grant.js"

import type {
  ExecuteResult,
  ExecuteOptions,
  TaskOptions,
  UndoCandidate,
  StoredCommand,
  StoredQuery,
  ToolEntry,
  UndoGuard,
} from "./registry-types.js"
export type { AgentGates, ExecuteResult, ToolEntry }

function jsonInput(input: unknown): unknown {
  return JSON.parse(JSON.stringify(input))
}

const taskExecution = Symbol("taskExecution")
const approvedDelegate = Symbol("approvedDelegate")

export class Registry extends CatalogPublication {
  private readonly commands = new Map<string, StoredCommand>()
  private readonly queries = new Map<string, StoredQuery>()
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

  addCommand<I, O>(
    spec: CommandSpec<I, O>,
    handler: (input: I, actor: Actor) => Promise<O>
  ) {
    const checked = defineCommand(spec)
    if (this.commands.has(checked.name) || this.queries.has(checked.name)) {
      throw new Error(`Duplicate registry entry ${checked.name}`)
    }
    this.commands.set(checked.name, {
      name: checked.name,
      description: checked.description,
      coach: checked.coach,
      delegate: checked.delegate,
      writes: (raw) => checked.writes?.(parseInput(checked.input, raw)) ?? [],
      destructive: checked.destructive,
      input: checked.input,
      transaction: checked.transaction,
      idempotency: checked.idempotency ?? "keyed",
      step: (raw) => {
        const parsed = checked.input.safeParse(raw)
        return parsed.success ? checked.step(parsed.data) : checked.name
      },
      run: async (raw, actor) => {
        const input = parseInput(checked.input, raw)
        const output = await handler(input, actor)
        return {
          output,
          draft: checked.activity(input, output, actor),
          reversal: checked.reversal(input, output),
          step: checked.step(input),
        }
      },
    })
  }

  addQuery<I, O>(spec: QuerySpec<I, O>) {
    if (this.commands.has(spec.name) || this.queries.has(spec.name)) {
      throw new Error(`Duplicate registry entry ${spec.name}`)
    }
    this.queries.set(spec.name, {
      name: spec.name,
      description: spec.description,
      coach: spec.coach,
      delegate: spec.delegate,
      input: spec.input,
      step: (raw) => {
        const parsed = spec.input.safeParse(raw)
        return parsed.success ? spec.step(parsed.data) : spec.name
      },
      read: async (raw, actor) => spec.read(parseInput(spec.input, raw), actor),
    })
  }

  list() {
    return {
      commands: [...this.commands.values()].map((command) => ({
        name: command.name,
        coach: command.coach,
        destructive: command.destructive,
      })),
      queries: [...this.queries.values()].map((query) => ({
        name: query.name,
        coach: query.coach,
      })),
    }
  }

  taskRequiresApproval(name: string, input: unknown) {
    const command = this.commands.get(name)
    return command
      ? effectiveCoachPolicy(command, parseInput(command.input, input)) ===
          "confirm"
      : false
  }

  commandNames() {
    return [...this.commands.keys()]
  }

  async tools(actor: Actor): Promise<ToolEntry[]> {
    const branded = brandedActor(actor)
    const gates = isCoachActor(branded)
      ? await agentGates(branded.userId)
      : null
    const entries: ToolEntry[] = []
    for (const command of this.commands.values()) {
      if (!delegateAllowed(command, branded)) continue
      if (gates && coachRefusal(command, gates)) continue
      entries.push({
        name: command.name,
        description: command.description,
        kind: "command",
        coach: command.coach,
        destructive: command.destructive,
        step: command.step,
        input: command.input,
      })
    }
    for (const query of this.queries.values()) {
      if (!delegateAllowed(query, branded)) continue
      if (gates && coachRefusal(query, gates)) continue
      entries.push({
        name: query.name,
        description: query.description,
        kind: "query",
        coach: query.coach,
        destructive: false,
        step: query.step,
        input: query.input,
      })
    }
    return entries
  }

  executeTask(lease: TaskLease, options: TaskOptions) {
    const command = this.commands.get(options.name)
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
    }
  ): Promise<ExecuteResult> {
    if (options.idempotencyKey?.startsWith("coach:") && !options[taskExecution])
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
    const effect = async (): Promise<ExecuteResult> => {
      const ran = await withGrantScope(
        {
          ownerId: actor.userId,
          writes: command.writes?.(parsed) ?? [],
          expectedRevision: options.expectedRevision ?? null,
        },
        () => command.run(parsed, actor)
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

      if (
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

      if (!idempotencyKey) return effect()
      try {
        return await savepoint(effect)
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
            ? await activityByKey(userId, row.coachIntentKey ?? row.id)
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
        return activityByKey(userId, row.coachIntentKey ?? row.id).then(
          (receipt) => (receipt ? this.publicActivity(receipt) : null)
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
        idempotencyKey: row.coachIntentKey ?? row.id,
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
      return activityByKey(userId, row.coachIntentKey ?? row.id).then(
        (receipt) => (receipt ? this.publicActivity(receipt) : null)
      )
    })
  }

  async deny(userId: string, pendingActionId: string) {
    await expireIfStale(userId, pendingActionId)
    return transaction(async () => {
      const { row, task } = await lockProposal(userId, pendingActionId)
      if (row.status === "denied") return row
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
      return { ...row, status: "denied" as const }
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
