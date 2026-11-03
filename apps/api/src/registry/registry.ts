import {
  ERROR_CODES,
  approvedProposalActor,
  coachActor,
  defineCommand,
  isCoachActor,
  personActor,
  type ActivityDraft,
  type Actor,
  type CoachAccess,
  type CommandSpec,
  type QuerySpec,
  type ReversalPlan,
} from "@workspace/domain"
import type { ZodType } from "zod"
import { and, eq } from "drizzle-orm"

import { activity, idempotency, pendingActions, user } from "../db/schema.js"
import { getDb, transaction } from "../db/context.js"
import { createId } from "../id.js"
import { CommandError, isUniqueViolation } from "./errors.js"

import { receiptDetail, reversalOf } from "./receipt.js"
import { readTurnReceipts, replay, replayStored } from "./turn-receipts.js"

const PENDING_TTL_MS = 24 * 60 * 60 * 1000

const CHECKLIST_COMMANDS = new Set([
  "job.addChecklistItem",
  "job.setChecklistItem",
  "job.removeChecklistItem",
])

export type AgentGates = {
  agentCvs: boolean
  agentInterview: boolean
  agentEmail: boolean
}

type CoachRefusal = "never" | "cvs" | "interview" | "email"

const REFUSAL_MESSAGES: Record<CoachRefusal, string> = {
  never: "The Coach cannot do this",
  cvs: "Turn on Tailored CVs for the Coach in Settings",
  interview: "Turn on Interview prep for the Coach in Settings",
  email: "Turn on Email updates for the Coach in Settings",
}

/** The one decision on whether a Coach actor may use an entry, for tools, execute, approve and read. */
export function coachRefusal(
  entry: { name: string; coach: CoachAccess | boolean },
  gates: AgentGates
): CoachRefusal | null {
  if (entry.coach === "never" || entry.coach === false) return "never"
  // agent_cvs hides paper.edit for letters too.
  if (entry.name === "paper.edit" && !gates.agentCvs) return "cvs"
  if (CHECKLIST_COMMANDS.has(entry.name) && !gates.agentInterview) {
    return "interview"
  }
  if (entry.name.startsWith("inbox.") && !gates.agentEmail) return "email"
  return null
}

type RanCommand = {
  output: unknown
  draft: ActivityDraft | null
  reversal: ReversalPlan
  step: string
}

type StoredCommand = {
  name: string
  description: string
  coach: CoachAccess
  destructive: boolean
  input: ZodType
  step: (input: unknown) => string
  transaction?: "none"
  idempotency: "keyed" | "none"
  run: (input: unknown, actor: Actor) => Promise<RanCommand>
}

type StoredQuery = {
  name: string
  description: string
  coach: boolean
  input: ZodType
  step: (input: unknown) => string
  read: (input: unknown, actor: Actor) => Promise<unknown>
}

export type ToolEntry = {
  name: string
  description: string
  kind: "command" | "query"
  coach: CoachAccess | boolean
  destructive: boolean
  step: (input: unknown) => string
  input: ZodType
}

export type ExecuteResult = {
  pending: boolean
  pendingActionId?: string
  summary?: string
  command?: string
  output?: unknown
  activityId: string | null
  reversal: ReversalPlan
  detail?: unknown
}

function zodMessage(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Invalid input"
}

function parseInput<T>(schema: ZodType<T>, raw: unknown): T {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    throw new CommandError(
      ERROR_CODES.VALIDATION_ERROR,
      zodMessage(parsed.error)
    )
  }
  return parsed.data
}

function brandedActor(actor: Actor): Actor {
  if (actor.type === "person") return personActor(actor.userId)
  return actor.turnId
    ? coachActor(actor.userId, actor.chatId, actor.turnId)
    : approvedProposalActor(actor.userId, actor.chatId)
}

export class Registry {
  private readonly commands = new Map<string, StoredCommand>()
  private readonly queries = new Map<string, StoredQuery>()
  private readonly undoGuards = new Map<
    string,
    (userId: string, inputs: unknown[]) => Promise<(string | null)[]>
  >()

  addUndoGuard(
    reversalCommand: string,
    guard: (userId: string, inputs: unknown[]) => Promise<(string | null)[]>
  ) {
    this.undoGuards.set(reversalCommand, guard)
  }

  async undoBlockedReasons(
    userId: string,
    items: readonly { command: string | null; input: unknown }[]
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
          indexes.map((index) => items[index]!.input)
        )
        indexes.forEach((index, at) => {
          reasons[index] = answers[at] ?? null
        })
      } catch {
        for (const index of indexes) reasons[index] = "Undo is not available"
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

  async execute(options: {
    name: string
    input: unknown
    actor: Actor
    idempotencyKey?: string
    skipConfirm?: boolean
  }): Promise<ExecuteResult> {
    const command = this.commands.get(options.name)
    if (!command) {
      throw new CommandError(ERROR_CODES.UNKNOWN_COMMAND, "Unknown command")
    }
    const actor = brandedActor(options.actor)
    if (isCoachActor(actor)) {
      const refusal = coachRefusal(command, await this.agentGates(actor.userId))
      if (refusal) {
        throw new CommandError(
          ERROR_CODES.COACH_NOT_ALLOWED,
          REFUSAL_MESSAGES[refusal]
        )
      }
    }
    const parsed = parseInput(command.input, options.input)
    // A command that declares no key never stores one: its own write must stay replay-safe.
    const idempotencyKey =
      command.idempotency === "none" ? undefined : options.idempotencyKey

    const run = async () => {
      if (idempotencyKey) {
        const existing = await this.activityByKey(actor.userId, idempotencyKey)
        if (existing) return replay(existing)
        const stored = await this.idempotencyByKey(actor.userId, idempotencyKey)
        if (stored) return replayStored(stored.result)
      }

      if (
        isCoachActor(actor) &&
        command.coach === "confirm" &&
        !options.skipConfirm
      ) {
        const id = createId()
        const summary = command.step(parsed)
        await getDb()
          .insert(pendingActions)
          .values({
            id,
            userId: actor.userId,
            chatId: actor.chatId,
            turnId: actor.turnId ?? null,
            command: command.name,
            input: parsed,
            summary,
            status: "pending",
          })
        return {
          pending: true,
          pendingActionId: id,
          summary,
          command: command.name,
          activityId: null,
          reversal: null,
        }
      }

      const ran = await command.run(parsed, actor)
      let activityId: string | null = null
      if (ran.draft) {
        activityId = createId()
        try {
          await getDb()
            .insert(activity)
            .values({
              id: activityId,
              userId: actor.userId,
              actor: actor.type,
              command: command.name,
              subjectKind: ran.draft.subjectKind,
              subjectId: ran.draft.subjectId,
              summary: ran.draft.summary,
              detail: ran.draft.detail ?? null,
              result: ran.output ?? null,
              reversalCommand: ran.reversal?.command ?? null,
              reversalInput: ran.reversal?.input ?? null,
              idempotencyKey: idempotencyKey ?? null,
              turnId: isCoachActor(actor) ? (actor.turnId ?? null) : null,
            })
        } catch (error) {
          if (!idempotencyKey || !isUniqueViolation(error)) throw error
          const existing = await this.activityByKey(
            actor.userId,
            idempotencyKey
          )
          if (!existing) throw error
          return replay(existing)
        }
      } else if (idempotencyKey) {
        try {
          await getDb()
            .insert(idempotency)
            .values({
              userId: actor.userId,
              key: idempotencyKey,
              command: command.name,
              result: ran.output ?? null,
            })
        } catch (error) {
          if (!isUniqueViolation(error)) throw error
          const stored = await this.idempotencyByKey(
            actor.userId,
            idempotencyKey
          )
          if (!stored) throw error
          return replayStored(stored.result)
        }
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
    if (command.transaction === "none") return run()
    return transaction(run)
  }

  async read(name: string, input: unknown, actor: Actor) {
    const query = this.queries.get(name)
    if (!query) {
      throw new CommandError(ERROR_CODES.UNKNOWN_COMMAND, "Unknown query")
    }
    const branded = brandedActor(actor)
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

  turnReceipts(userId: string, turnIds: string[]) {
    return readTurnReceipts(userId, turnIds)
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
            ? await this.activityByKey(userId, row.id)
            : null
        return {
          id: row.id,
          status:
            row.status === "pending" &&
            Date.now() - row.createdAt.getTime() > PENDING_TTL_MS
              ? ("expired" as const)
              : row.status,
          receipt: completed
            ? {
                summary: completed.summary,
                activityId: completed.id,
                reversal: reversalOf(
                  completed.reversalCommand
                    ? {
                        command: completed.reversalCommand,
                        input: completed.reversalInput,
                      }
                    : null,
                  completed.summary
                ),
                detail: receiptDetail(completed.command, completed.result),
                undone: completed.undoneAt !== null,
              }
            : undefined,
        }
      })
    )
  }

  async approve(userId: string, pendingActionId: string) {
    await this.expireIfStale(userId, pendingActionId)
    return transaction(async () => {
      const row = await this.lockPending(userId, pendingActionId)
      if (row.status === "approved") {
        return this.activityByKey(userId, row.id)
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
      const result = await this.execute({
        name: row.command,
        input: row.input,
        actor: approvedProposalActor(userId, row.chatId),
        idempotencyKey: row.id,
        skipConfirm: true,
      })
      await getDb()
        .update(pendingActions)
        .set({ status: "approved" })
        .where(eq(pendingActions.id, row.id))
      if (result.activityId) return this.activityById(userId, result.activityId)
      return this.activityByKey(userId, row.id)
    })
  }

  async deny(userId: string, pendingActionId: string) {
    await this.expireIfStale(userId, pendingActionId)
    return transaction(async () => {
      const row = await this.lockPending(userId, pendingActionId)
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
      return { ...row, status: "denied" as const }
    })
  }

  async undo(userId: string, activityId: string) {
    return transaction(async () => {
      const row = await this.lockActivity(userId, activityId)
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
      const blocked = await this.undoBlockedReason(
        userId,
        row.reversalCommand,
        row.reversalInput
      )
      if (blocked) throw new CommandError(ERROR_CODES.CONFLICT, blocked)
      await this.execute({
        name: row.reversalCommand,
        input: row.reversalInput,
        actor: personActor(userId),
        idempotencyKey: `undo:${row.id}`,
        skipConfirm: true,
      })
      const undoneAt = new Date()
      await getDb()
        .update(activity)
        .set({ undoneAt })
        .where(eq(activity.id, row.id))
      return { ...row, undoneAt }
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
    // No user row means no consent to read, so every gated entry stays closed.
    return (
      rows[0] ?? { agentCvs: false, agentInterview: false, agentEmail: false }
    )
  }

  private async expireIfStale(userId: string, id: string) {
    const rows = await getDb()
      .select()
      .from(pendingActions)
      .where(and(eq(pendingActions.id, id), eq(pendingActions.userId, userId)))
      .limit(1)
    const row = rows[0]
    if (!row || row.status !== "pending") return
    if (Date.now() - row.createdAt.getTime() <= PENDING_TTL_MS) return
    await getDb()
      .update(pendingActions)
      .set({ status: "expired" })
      .where(eq(pendingActions.id, row.id))
    throw new CommandError(
      ERROR_CODES.PENDING_EXPIRED,
      "This confirmation expired. Ask the Coach again."
    )
  }

  private async lockPending(userId: string, id: string) {
    const rows = await getDb()
      .select()
      .from(pendingActions)
      .where(and(eq(pendingActions.id, id), eq(pendingActions.userId, userId)))
      .for("update")
    const row = rows[0]
    if (!row) {
      throw new CommandError(
        ERROR_CODES.NOT_FOUND,
        "That confirmation was not found"
      )
    }
    return row
  }

  private async lockActivity(userId: string, id: string) {
    const rows = await getDb()
      .select()
      .from(activity)
      .where(and(eq(activity.id, id), eq(activity.userId, userId)))
      .for("update")
    const row = rows[0]
    if (!row) {
      throw new CommandError(
        ERROR_CODES.NOT_FOUND,
        "That activity was not found"
      )
    }
    return row
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
