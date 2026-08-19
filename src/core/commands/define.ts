import type { PoolClient } from "pg";
import type { z } from "zod";

export type ActorKind = "user" | "coach" | "system";

export type Actor = {
  kind: ActorKind;
  userId: string;
  conversationId?: string;
};

export type Inverse = { name: string; input: unknown } | null;

export type CommandDef<TInput = unknown, TResult = unknown> = {
  name: string;
  input: z.ZodType<TInput>;
  description: string;
  agent: boolean;
  destructive?: boolean;
  handler: (args: {
    actor: Actor;
    input: TInput;
    client: PoolClient;
  }) => Promise<{ result: TResult; inverse: Inverse }>;
};

const registry = new Map<string, CommandDef>();

export function defineCommand<TInput, TResult>(
  def: CommandDef<TInput, TResult>,
) {
  if (registry.has(def.name) && process.env.NODE_ENV !== "development") {
    throw new Error(`command already defined: ${def.name}`);
  }
  registry.set(def.name, def as CommandDef);
  return def;
}

export function getCommand(name: string) {
  return registry.get(name);
}

export function listCommands() {
  return [...registry.values()];
}

export function agentCommands() {
  return listCommands().filter((c) => c.agent);
}
