import { z } from "zod";
import { defineCommand } from "@/core/commands/define";
import { newId } from "@/core/ids";
import { appOpenInputSchema, type AppOpenResult } from "@/features/coach/model";

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

defineCommand({
  name: "app.open",
  agent: true,
  description:
    "Open a place or artifact the user asked to see. Use when they say open, take me to, show me, or go to. Place is chat, paper, proof, pitch, search, apply, profile, or settings. Pass paperId, proofId, or applicationId only when they named a specific item. Search has no id — for a saved opening, open its Apply row. Never open auth, landing, onboarding, or another person's public page.",
  input: appOpenInputSchema,
  async handler({ actor, input, client }): Promise<{ result: AppOpenResult; inverse: null }> {
    if (input.place === "paper" && input.paperId) {
      const { rows } = await client.query(
        `select id from papers where id=$1 and user_id=$2`,
        [input.paperId, actor.userId],
      );
      if (!rows[0]) {
        return {
          result: { ok: false, error: "That paper is not here. Open Paper to see your list." },
          inverse: null,
        };
      }
    }
    if (input.place === "proof" && input.proofId) {
      const { rows } = await client.query(
        `select id from proofs where id=$1 and user_id=$2`,
        [input.proofId, actor.userId],
      );
      if (!rows[0]) {
        return {
          result: { ok: false, error: "That Proof is not here. Open Proof to see your list." },
          inverse: null,
        };
      }
    }
    if (input.place === "apply" && input.applicationId) {
      const { rows } = await client.query(
        `select id from applications where id=$1 and user_id=$2`,
        [input.applicationId, actor.userId],
      );
      if (!rows[0]) {
        return {
          result: { ok: false, error: "That Apply row is not here. Open Apply to see your list." },
          inverse: null,
        };
      }
    }
    return { result: { ok: true, ...input }, inverse: null };
  },
});
