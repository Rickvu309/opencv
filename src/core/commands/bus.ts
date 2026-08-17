import { newId } from "@/core/ids";
import { withTx } from "@/core/db/client.server";
import {
  getCommand,
  type Actor,
  type Inverse,
} from "@/core/commands/define";
import type { PoolClient } from "pg";

export class CommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommandError";
  }
}

export async function executeCommand<T = unknown>(
  name: string,
  rawInput: unknown,
  actor: Actor,
  client?: PoolClient,
) {
  if (client) return run(name, rawInput, actor, client) as Promise<{ id: string; result: T }>;
  return withTx((c) => run(name, rawInput, actor, c)) as Promise<{
    id: string;
    result: T;
  }>;
}

async function run(
  name: string,
  rawInput: unknown,
  actor: Actor,
  client: PoolClient,
) {
  const def = getCommand(name);
  if (!def) throw new CommandError(`unknown command ${name}`);
  const input = def.input.parse(rawInput);
  const { result, inverse } = await def.handler({ actor, input, client });
  const id = newId();
  await client.query(
    `insert into command_log (id, user_id, actor, name, input, inverse, conversation_id)
     values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)`,
    [
      id,
      actor.userId,
      actor.kind,
      name,
      JSON.stringify(input),
      inverse ? JSON.stringify(inverse) : null,
      actor.conversationId ?? null,
    ],
  );
  return { id, result };
}

export async function undoCommand(logId: string, actor: Actor) {
  return withTx(async (client) => {
    const { rows } = await client.query<{
      id: string;
      inverse: Inverse;
      undone_by: string | null;
    }>(
      `select id, inverse, undone_by from command_log where id = $1 and user_id = $2`,
      [logId, actor.userId],
    );
    const row = rows[0];
    if (!row) throw new CommandError("that change was not found");
    if (row.undone_by) throw new CommandError("that change was already undone");
    if (!row.inverse) throw new CommandError("that change cannot be undone");
    const executed = await run(row.inverse.name, row.inverse.input, actor, client);
    await client.query(`update command_log set undone_by = $1 where id = $2`, [
      executed.id,
      row.id,
    ]);
    return executed;
  });
}
