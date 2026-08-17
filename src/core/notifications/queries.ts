import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";

export const listNotificationsFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const { requireUser } = await import("@/core/auth/session");
    const { withClient } = await import("@/core/db/client.server");
    const user = await requireUser();
    const { rows } = await withClient((c) =>
      c.query(
        `select id, kind, payload, read_at, created_at from notifications
         where user_id = $1 order by created_at desc limit 30`,
        [user.id],
      ),
    );
    return rows;
  },
);

export const markReadFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async (ctx) => {
    const data = ctx.data as { id: string };
    const { requireUser } = await import("@/core/auth/session");
    const { withClient } = await import("@/core/db/client.server");
    const user = await requireUser();
    await withClient((c) =>
      c.query(
        `update notifications set read_at = now() where id = $1 and user_id = $2`,
        [data.id, user.id],
      ),
    );
    return { ok: true };
  });
