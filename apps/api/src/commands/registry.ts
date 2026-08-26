import {
  ERROR_CODES,
  errorEnvelope,
  httpStatusForError,
  successEnvelope,
  type CommandActor,
  type CommandEnvelope,
  type ReversalDescriptor,
} from "@workspace/domain"

import type { AuthDatabase } from "../auth.js"

export type AppDatabase = AuthDatabase

export type CommandContext = {
  db: AppDatabase
  actor: CommandActor
}

type ParseFailure = {
  success: false
  error: { issues: { message: string }[] }
}

type InputSchema<TInput> = {
  safeParse(input: unknown): { success: true; data: TInput } | ParseFailure
}

export type CommandDefinition<TInput, TOutput> = {
  name: string
  /** Human description for the Coach tool surface (ADR-0007). */
  description: string
  input: InputSchema<TInput>
  coachAllowed: boolean
  destructive: boolean
  reversal: ReversalDescriptor
  /** Capture pre-mutation state used to plan a one-click undo. */
  captureForReversal?: (
    ctx: CommandContext,
    input: TInput
  ) => Promise<unknown>
  /** Build `reversal.input` after a successful handler. */
  reversalInput?: (args: {
    input: TInput
    output: TOutput
    captured: unknown
  }) => unknown
  handler: (ctx: CommandContext, input: TInput) => Promise<TOutput>
}

export type RegisteredCommand = CommandDefinition<unknown, unknown>

export type CommandExecution = {
  status: number
  body: CommandEnvelope
  reversal?: ReversalDescriptor
}

export class CommandError extends Error {
  readonly code: string
  readonly status: number

  constructor(
    code: string,
    message: string,
    status = httpStatusForError(code)
  ) {
    super(message)
    this.name = "CommandError"
    this.code = code
    this.status = status
  }
}

export function defineCommand<TInput, TOutput>(
  definition: CommandDefinition<TInput, TOutput>
): CommandDefinition<TInput, TOutput> {
  return definition
}

export function createRegistry(commands: RegisteredCommand[]) {
  const byName = new Map(commands.map((command) => [command.name, command]))

  return {
    get(name: string) {
      return byName.get(name)
    },
    list() {
      return [...byName.values()]
    },
    async execute({
      name,
      input,
      actor,
      db,
    }: {
      name: string
      input: unknown
      actor: CommandActor
      db: AppDatabase
    }): Promise<CommandExecution> {
      const command = byName.get(name)
      if (!command) {
        return {
          status: httpStatusForError(ERROR_CODES.UNKNOWN_COMMAND),
          body: errorEnvelope(ERROR_CODES.UNKNOWN_COMMAND, "Unknown command"),
        }
      }

      const parsed = command.input.safeParse(input)
      if (!parsed.success) {
        const message =
          parsed.error.issues[0]?.message ?? "Invalid command input"
        return {
          status: httpStatusForError(ERROR_CODES.VALIDATION_ERROR),
          body: errorEnvelope(ERROR_CODES.VALIDATION_ERROR, message),
        }
      }

      if (actor.type === "coach" && !command.coachAllowed) {
        return {
          status: httpStatusForError(ERROR_CODES.COACH_NOT_ALLOWED),
          body: errorEnvelope(
            ERROR_CODES.COACH_NOT_ALLOWED,
            "This Command cannot be run by the Coach"
          ),
        }
      }

      const ctx = { db, actor }
      let captured: unknown
      if (command.captureForReversal) {
        try {
          captured = await command.captureForReversal(ctx, parsed.data)
        } catch (error) {
          if (error instanceof CommandError) {
            return {
              status: error.status,
              body: errorEnvelope(error.code, error.message),
            }
          }
          throw error
        }
      }

      try {
        const data = await command.handler(ctx, parsed.data)
        return {
          status: 200,
          body: successEnvelope(data),
          reversal: planReversal(command, parsed.data, data, captured),
        }
      } catch (error) {
        if (error instanceof CommandError) {
          return {
            status: error.status,
            body: errorEnvelope(error.code, error.message),
          }
        }
        throw error
      }
    },
  }
}

export type CommandRegistry = ReturnType<typeof createRegistry>

function planReversal(
  command: RegisteredCommand,
  input: unknown,
  output: unknown,
  captured: unknown
): ReversalDescriptor {
  const base = command.reversal
  if (!base.possible || !command.reversalInput) return base
  return {
    ...base,
    input: command.reversalInput({ input, output, captured }),
  }
}
