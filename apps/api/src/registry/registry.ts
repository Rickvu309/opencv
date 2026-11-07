import {
  coachRefusal,
  type AgentGates,
  REFUSAL_MESSAGES,
  GATES_CLOSED_WITHOUT_CONSENT_TO_READ,
  omitStoredKeySoTheCommandsOwnWriteStaysReplaySafe,
} from "./coach-policy.js"
export type { AgentGates } from "./coach-policy.js"
export { coachRefusal } from "./coach-policy.js"
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
  type ReversalExpect,
} from "@workspace/domain"
import { and, eq } from "drizzle-orm"

import { activity, idempotency, pendingActions, user } from "../db/schema.js"
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

import type {
  ExecuteResult,
  StoredCommand,
  StoredQuery,
  ToolEntry,
  UndoGuard,
} from "./registry-types.js"
export type { ExecuteResult, ToolEntry } from "./registry-types.js"

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
    items: readonly {
      command: string | null
      input: unknown
      expect?: ReversalExpect | null
      source?: string | null
    }[]
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
  ): Promise<string | null> {
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
      ? await this.agentGates(branded.userId)
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

  executeTask(
    lease: TaskLease,
    options: {
      name: string
      input: unknown
      actor: Actor
      idempotencyKey: string
    }
  ) {
    return executeTaskCommand(
      lease,
      options,
      this.commands.get(options.name),
      (input) => this.execute({ ...input, [taskExecution]: true })
    )
  }

  async execute(options: {
    name: string
    input: unknown
    actor: Actor
    idempotencyKey?: string
    skipConfirm?: boolean
    skipActivity?: boolean
    [taskExecution]?: boolean
    [approvedDelegate]?: string
  }): Promise<ExecuteResult> {
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
        await this.agentGates(actor.userId)
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

    const hash = idempotencyKey ? inputHash(options.input) : null
    const effect = async (): Promise<ExecuteResult> => {
      const ran = await command.run(parsed, actor)
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
      const refusal = coachRefusal(query, await this.agentGates(branded.userId))
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
            ? await this.activityByKey(userId, row.coachIntentKey ?? row.id)
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
        return this.activityByKey(userId, row.coachIntentKey ?? row.id).then(
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
        return this.activityById(userId, result.activityId).then((receipt) =>
          receipt ? this.publicActivity(receipt) : null
        )
      return this.activityByKey(userId, row.coachIntentKey ?? row.id).then(
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

  private async agentGates(userId: string): Promise<AgentGates> {
    const rows = await getDb()
      .select({
        agentCvs: user.agentCvs,
        agentInterview: user.agentInterview,
        agentEmail: user.agentEmail,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)
    return rows[0] ?? GATES_CLOSED_WITHOUT_CONSENT_TO_READ
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
    const existing = await this.activityByKey(userId, key)
    const stored = existing ?? (await this.idempotencyByKey(userId, key))
    if (!stored) return null
    if (stored.command !== command || stored.inputHash !== hash)
      throw new CommandError(
        ERROR_CODES.CONFLICT,
        "Idempotency key does not match its command and input"
      )
    return {
      ...(existing ? replay(existing) : replayStored(stored.result)),
      command: stored.command,
    }
  }

  private async activityByKey(userId: string, key: string) {
    const rows = await getDb()
      .select()
      .from(activity)
      .where(and(eq(activity.userId, userId), eq(activity.idempotencyKey, key)))
      .limit(1)
    return rows[0] ?? null
  }

  private async activityById(userId: string, id: string) {
    const rows = await getDb()
      .select()
      .from(activity)
      .where(and(eq(activity.userId, userId), eq(activity.id, id)))
      .limit(1)
    return rows[0] ?? null
  }

  private async idempotencyByKey(userId: string, key: string) {
    const rows = await getDb()
      .select()
      .from(idempotency)
      .where(and(eq(idempotency.userId, userId), eq(idempotency.key, key)))
      .limit(1)
    return rows[0] ?? null
  }
}

export const registry = new Registry()
