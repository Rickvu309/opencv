import { z } from "zod";
import { defineCommand } from "@/core/commands/define";
import { newId } from "@/core/ids";

defineCommand({
  name: "pitch.saveBio",
  agent: true,
  description: "Write or replace the online bio from the profile.",
  input: z.object({ body: z.string() }),
  async handler({ actor, input, client }) {
    const { rows } = await client.query(
      `select id, body from pitch_items where user_id=$1 and kind='bio'`,
      [actor.userId],
    );
    const prev = rows[0];
    const id = prev?.id ?? newId();
    await client.query(
      `insert into pitch_items (id, user_id, kind, body) values ($1,$2,'bio',$3)
       on conflict (id) do update set body=$3, updated_at=now()`,
      [id, actor.userId, input.body],
    );
    return {
      result: { id },
      inverse: prev
        ? { name: "pitch.saveBio", input: { body: prev.body } }
        : { name: "pitch.removeItem", input: { id } },
    };
  },
});

defineCommand({
  name: "pitch.saveIntro",
  agent: true,
  description: "Write or replace the self-introduction. Ask for a goal first if none is set.",
  input: z.object({ body: z.string() }),
  async handler({ actor, input, client }) {
    const { rows } = await client.query(
      `select id, body from pitch_items where user_id=$1 and kind='intro'`,
      [actor.userId],
    );
    const prev = rows[0];
    const id = prev?.id ?? newId();
    await client.query(
      `insert into pitch_items (id, user_id, kind, body) values ($1,$2,'intro',$3)
       on conflict (id) do update set body=$3, updated_at=now()`,
      [id, actor.userId, input.body],
    );
    return {
      result: { id },
      inverse: prev
        ? { name: "pitch.saveIntro", input: { body: prev.body } }
        : { name: "pitch.removeItem", input: { id } },
    };
  },
});

defineCommand({
  name: "pitch.addAnswer",
  agent: true,
  description: "Save an interview answer. Must rest on work the user actually did.",
  input: z.object({ prompt: z.string(), body: z.string() }),
  async handler({ actor, input, client }) {
    const id = newId();
    await client.query(
      `insert into pitch_items (id, user_id, kind, prompt, body) values ($1,$2,'answer',$3,$4)`,
      [id, actor.userId, input.prompt, input.body],
    );
    return { result: { id }, inverse: { name: "pitch.removeItem", input: { id } } };
  },
});

defineCommand({
  name: "pitch.updateItem",
  agent: true,
  description: "Refine a pitch item in place.",
  input: z.object({ id: z.string(), body: z.string(), prompt: z.string().optional() }),
  async handler({ actor, input, client }) {
    const { rows } = await client.query(
      `select body, prompt from pitch_items where id=$1 and user_id=$2`,
      [input.id, actor.userId],
    );
    await client.query(
      `update pitch_items set body=$3, prompt=coalesce($4, prompt), updated_at=now() where id=$1 and user_id=$2`,
      [input.id, actor.userId, input.body, input.prompt ?? null],
    );
    return {
      result: { ok: true },
      inverse: {
        name: "pitch.updateItem",
        input: { id: input.id, body: rows[0]?.body, prompt: rows[0]?.prompt },
      },
    };
  },
});

defineCommand({
  name: "pitch.removeItem",
  agent: true,
  destructive: true,
  description: "Remove a pitch item.",
  input: z.object({ id: z.string() }),
  async handler({ actor, input, client }) {
    await client.query(`delete from pitch_items where id=$1 and user_id=$2`, [
      input.id,
      actor.userId,
    ]);
    return { result: { ok: true }, inverse: null };
  },
});
