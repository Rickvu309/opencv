import {
  ERROR_CODES,
  defineCommand,
  isCoachActor,
  type ActivityDraft,
  type Actor,
  type CoachAccess,
  type CommandSpec,
  type QuerySpec,
  type ReversalPlan,
} from "@workspace/domain"
import type { ZodType } from "zod"
import { and, eq } from "drizzle-orm"

import { activity, pendingActions } from "../db/schema.js"
import { getDb, transaction } from "../db/context.js"
import { createId } from "../id.js"
import { CommandError, isUniqueViolation } from "./errors.js"

const PENDING_TTL_MS = 24 * 60 * 60 * 1000

type StoredCommand = {
  name: string
  description: string
  coach: CoachAccess
  destructive: boolean
  input: ZodType
  reversal: (input: unknown, output: unknown) => ReversalPlan
  step: (input: unknown) => string
  activity: (
    input: unknown,
    output: unknown,
    actor: Actor
  ) => ActivityDraft | null
  handler: (input: unknown, actor: Actor) => Promise<unknown>
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
}

type ActivityRow = typeof activity.$inferSelect

function zodMessage(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Invalid input"
}

export class Registry {
  private readonly commands = new Map<string, StoredCommand>()
  private readonly queries = new Map<string, StoredQuery>()

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
      reversal: (input, output) => checked.reversal(input as I, output as O),
      step: (input) => checked.step(input as I),
      activity: (input, output, actor) =>
        checked.activity(input as I, output as O, actor),
      handler: (input, actor) => handler(input as I, actor),
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
      step: (input) => spec.step(input as I),
      read: (input, actor) => spec.read(input as I, actor),
    })
  }

  list() {
    return {
      commands: [...this.commands.values()].map((command) => ({
        name: command.name,
        coach: command.coach,
        destructive: command.destructive,
        reversal: command.reversal.length >= 0,
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

  tools(actor: Actor): ToolEntry[] {
    const entries: ToolEntry[] = []
    for (const command of this.commands.values()) {
      if (isCoachActor(actor) && command.coach === "never") continue
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
      if (isCoachActor(actor) && !query.coach) continue
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
    if (isCoachActor(options.actor) && command.coach === "never") {
      throw new CommandError(
        ERROR_CODES.COACH_NOT_ALLOWED,
        "The Coach cannot run this command"
      )
    }
    const parsed = command.input.safeParse(options.input)
    if (!parsed.success) {
      throw new CommandError(ERROR_CODES.VALIDATION_ERROR, zodMessage(parsed.error))
    }

    return transaction(async () => {
      if (options.idempotencyKey) {
        const existing = await this.activityByKey(
          options.actor.userId,
          options.idempotencyKey
        )
        if (existing) return replay(existing)
      }

      if (
        isCoachActor(options.actor) &&
        command.coach === "confirm" &&
        !options.skipConfirm
      ) {
        const id = createId()
        const summary = command.step(parsed.data)
        await getDb().insert(pendingActions).values({
          id,
          userId: options.actor.userId,
          chatId: options.actor.chatId,
          command: command.name,
          input: parsed.data,
          summary,
          status: "pending",
        })
        return {
          pending: true,
          pendingActionId: id,
          summary,
          command: command.name,
          activityId: null,
        }
      }

      const output = await command.handler(parsed.data, options.actor)
      const draft = command.activity(parsed.data, output, options.actor)
      const reversal = command.reversal(parsed.data, output)
      let activityId: string | null = null
      if (draft || options.idempotencyKey) {
        activityId = createId()
        try {
          await getDb().insert(activity).values({
            id: activityId,
            userId: options.actor.userId,
            actor: options.actor.type,
            command: command.name,
            subjectKind: draft?.subjectKind ?? "account",
            subjectId: draft?.subjectId ?? options.actor.userId,
            summary: draft?.summary ?? command.step(parsed.data),
            detail: draft?.detail ?? null,
            result: output as never,
            reversalCommand: reversal?.command ?? null,
            reversalInput: reversal?.input ?? null,
            idempotencyKey: options.idempotencyKey ?? null,
          })
        } catch (error) {
          if (!options.idempotencyKey || !isUniqueViolation(error)) throw error
          const existing = await this.activityByKey(
            options.actor.userId,
            options.idempotencyKey
          )
          if (!existing) throw error
          return replay(existing)
        }
      }
      return { pending: false, output, activityId }
    })
  }

  async read(name: string, input: unknown, actor: Actor) {
    const query = this.queries.get(name)
    if (!query) {
      throw new CommandError(ERROR_CODES.UNKNOWN_COMMAND, "Unknown query")
    }
    if (isCoachActor(actor) && !query.coach) {
      throw new CommandError(
        ERROR_CODES.COACH_NOT_ALLOWED,
        "The Coach cannot read this"
      )
    }
    const parsed = query.input.safeParse(input)
    if (!parsed.success) {
      throw new CommandError(ERROR_CODES.VALIDATION_ERROR, zodMessage(parsed.error))
    }
    return query.read(parsed.data, actor)
  }

  async approve(userId: string, pendingActionId: string) {
    await this.expireIfStale(userId, pendingActionId)
    return transaction(async () => {
      const row = await this.lockPending(userId, pendingActionId)
      if (row.status === "approved") {
        const existing = await this.activityByKey(userId, row.id)
        return existing
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
        actor: { type: "coach", userId, chatId: row.chatId },
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
      if (row.reversalCommand) {
        await this.execute({
          name: row.reversalCommand,
          input: row.reversalInput,
          actor: { type: "person", userId },
          idempotencyKey: `undo:${row.id}`,
          skipConfirm: true,
        })
      }
      const undoneAt = new Date()
      await getDb()
        .update(activity)
        .set({ undoneAt })
        .where(eq(activity.id, row.id))
      return { ...row, undoneAt }
    })
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
      throw new CommandError(ERROR_CODES.NOT_FOUND, "That confirmation was not found")
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
      throw new CommandError(ERROR_CODES.NOT_FOUND, "That activity was not found")
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
}

function replay(row: ActivityRow): ExecuteResult {
  return {
    pending: false,
    output: row.result,
    activityId: row.id,
  }
}

export const registry = new Registry()
