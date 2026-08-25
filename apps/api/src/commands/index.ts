import { paperCommands } from "./paper.js"
import { createRegistry, type RegisteredCommand } from "./registry.js"
import { threadCommands } from "./threads.js"

export { CommandError, createRegistry, defineCommand } from "./registry.js"
export type {
  AppDatabase,
  CommandContext,
  CommandExecution,
  CommandRegistry,
  RegisteredCommand,
} from "./registry.js"

export const commandRegistry = createRegistry([
  ...threadCommands,
  ...paperCommands,
] as RegisteredCommand[])
