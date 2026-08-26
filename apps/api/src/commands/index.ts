import { applyCommands } from "./apply.js"
import { paperCommands } from "./paper.js"
import { profileCommands } from "./profile.js"
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
  ...applyCommands,
  ...profileCommands,
] as RegisteredCommand[])
