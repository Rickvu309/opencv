import {
  COACH_VOICE_COMMAND,
  ERROR_CODES,
  errorEnvelope,
  type CommandEnvelope,
  type ReversalDescriptor,
} from "@workspace/domain"

import { commandRegistry } from "../commands/index.js"
import type {
  AppDatabase,
  CommandRegistry,
  RegisteredCommand,
} from "../commands/registry.js"
import { coachReadTools, executeCoachRead } from "./reads.js"

/** Command envelope plus an optional hydrated reversal for translate.ts. */
export type CoachToolOutput = CommandEnvelope & {
  reversal?: ReversalDescriptor
}

export type CoachTool = {
  description: string
  inputSchema: RegisteredCommand["input"]
  execute: (input: unknown) => Promise<CoachToolOutput>
}

export type CoachToolSurface = Record<string, CoachTool>

export type AssembleCoachToolsOptions = {
  db: AppDatabase
  userId: string
  registry?: CommandRegistry
}

/** Provider grammars reject `.` in tool names; Commands keep dotted names. */
export function commandToToolName(commandName: string) {
  return commandName.replaceAll(".", "_")
}

/**
 * Mutation Commands the Coach may auto-run.
 *
 * Temporary (QVE-148 / ADR-0007): `!destructive` stays until a Coach tool
 * call can pause for User confirmation instead of executing. User-fired
 * deletes already confirm in the UI. Do not remove this filter without
 * that confirm path — `executeCoachMutation` also refuses destructive
 * Commands so a leaked tool still cannot run them.
 */
export function isCoachMutationCommand(command: RegisteredCommand) {
  return (
    command.coachAllowed &&
    !command.destructive &&
    command.name !== COACH_VOICE_COMMAND
  )
}

export async function executeCoachMutation({
  command,
  input,
  db,
  userId,
  registry,
}: {
  command: RegisteredCommand
  input: unknown
  db: AppDatabase
  userId: string
  registry: CommandRegistry
}): Promise<CoachToolOutput> {
  if (command.destructive) {
    return errorEnvelope(
      ERROR_CODES.COACH_NOT_ALLOWED,
      "This Command cannot be run by the Coach"
    )
  }

  const result = await registry.execute({
    name: command.name,
    input,
    actor: { type: "coach", userId },
    db,
  })
  if (result.body.ok && result.reversal) {
    return { ...result.body, reversal: result.reversal }
  }
  return result.body
}

function mutationToolsFromRegistry(
  registry: CommandRegistry,
  db: AppDatabase,
  userId: string
): CoachToolSurface {
  const tools: CoachToolSurface = {}

  for (const command of registry.list()) {
    if (!isCoachMutationCommand(command)) continue

    tools[commandToToolName(command.name)] = {
      description: command.description,
      inputSchema: command.input,
      execute: (input) =>
        executeCoachMutation({
          command,
          input,
          db,
          userId,
          registry,
        }),
    }
  }

  return tools
}

function readToolsFromTable(
  db: AppDatabase,
  userId: string
): CoachToolSurface {
  const tools: CoachToolSurface = {}

  for (const tool of coachReadTools) {
    tools[tool.name] = {
      description: tool.description,
      inputSchema: tool.input,
      execute: (input) => executeCoachRead(tool, { db, userId }, input),
    }
  }

  return tools
}

/**
 * Single enumeration point for the Coach tool surface (ADR-0007).
 * Mutations come from the registry; reads come from the parallel table.
 */
export function assembleCoachTools({
  db,
  userId,
  registry = commandRegistry,
}: AssembleCoachToolsOptions): CoachToolSurface {
  return {
    ...mutationToolsFromRegistry(registry, db, userId),
    ...readToolsFromTable(db, userId),
  }
}