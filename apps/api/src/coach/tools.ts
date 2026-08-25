import {
  COACH_VOICE_COMMAND,
  type CommandEnvelope,
} from "@workspace/domain"

import { commandRegistry } from "../commands/index.js"
import type {
  AppDatabase,
  CommandRegistry,
  RegisteredCommand,
} from "../commands/registry.js"
import { coachReadTools, executeCoachRead } from "./reads.js"

export type CoachTool = {
  description: string
  inputSchema: RegisteredCommand["input"]
  execute: (input: unknown) => Promise<CommandEnvelope>
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

export function isCoachMutationCommand(command: RegisteredCommand) {
  return (
    command.coachAllowed &&
    !command.destructive &&
    command.name !== COACH_VOICE_COMMAND
  )
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
      execute: async (input) => {
        const result = await registry.execute({
          name: command.name,
          input,
          actor: { type: "coach", userId },
          db,
        })
        return result.body
      },
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