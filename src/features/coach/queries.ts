import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { env } from "@/core/config/env";

export const listConversationsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { requireUser } = await import("@/core/auth/session");
  const { withClient } = await import("@/core/db/client.server");
  const user = await requireUser();
  const { rows } = await withClient((c) =>
    c.query(
      `select id, title, last_message_at from conversations where user_id=$1 order by last_message_at desc`,
      [user.id],
    ),
  );
  return { conversations: rows, offline: !env("OPENROUTER_API_KEY") };
});

export const getConversationFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async (ctx) => {
    const data = ctx.data as { id: string };
    const { requireUser } = await import("@/core/auth/session");
    const { withClient } = await import("@/core/db/client.server");
    const user = await requireUser();
    return withClient(async (c) => {
      const conv = (
        await c.query(`select * from conversations where id=$1 and user_id=$2`, [data.id, user.id])
      ).rows[0];
      if (!conv) return null;
      const messages = (
        await c.query(
          `select id, role, content, created_at from messages where conversation_id=$1 order by created_at`,
          [data.id],
        )
      ).rows;
      return { ...conv, messages, offline: !env("OPENROUTER_API_KEY") };
    });
  });
