import { z } from "zod";
import { defineCommand } from "@/core/commands/define";
import { newId } from "@/core/ids";

defineCommand({
  name: "conversation.start",
  agent: false,
  description: "Start a new Coach conversation.",
  input: z.object({ title: z.string().default("New conversation") }),
  async handler({ actor, input, client }) {
    const id = newId();
    await client.query(
      `insert into conversations (id, user_id, title) values ($1,$2,$3)`,
      [id, actor.userId, input.title],
    );
    return { result: { id }, inverse: { name: "conversation.remove", input: { id } } };
  },
});

defineCommand({
  name: "conversation.rename",
  agent: false,
  description: "Rename a conversation.",
  input: z.object({ id: z.string(), title: z.string() }),
  async handler({ actor, input, client }) {
    const { rows } = await client.query(
      `select title from conversations where id=$1 and user_id=$2`,
      [input.id, actor.userId],
    );
    await client.query(
      `update conversations set title=$3 where id=$1 and user_id=$2`,
      [input.id, actor.userId, input.title],
    );
    return {
      result: { ok: true },
      inverse: { name: "conversation.rename", input: { id: input.id, title: rows[0]?.title } },
    };
  },
});

defineCommand({
  name: "conversation.remove",
  agent: false,
  destructive: true,
  description: "Delete a conversation.",
  input: z.object({ id: z.string() }),
  async handler({ actor, input, client }) {
    await client.query(`delete from conversations where id=$1 and user_id=$2`, [
      input.id,
      actor.userId,
    ]);
    return { result: { ok: true }, inverse: null };
  },
});
