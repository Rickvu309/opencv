import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getProofPageFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug: z.string() }))
  .handler(async (ctx) => {
    const data = ctx.data as { slug: string };
    const { withClient } = await import("@/core/db/client.server");
    const { rows } = await withClient((c) =>
      c.query(`select content, published_at from proof_pages where slug=$1`, [data.slug]),
    );
    return rows[0] ?? null;
  });

export const getPersonalPageFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ handle: z.string() }))
  .handler(async (ctx) => {
    const data = ctx.data as { handle: string };
    const { withClient } = await import("@/core/db/client.server");
    return withClient(async (c) => {
      const handle = (
        await c.query(`select user_id, handle from handles where handle=$1`, [data.handle])
      ).rows[0];
      if (!handle) return null;
      const profile = (
        await c.query(`select name, summary from profiles where user_id=$1`, [handle.user_id])
      ).rows[0];
      const proofs = (
        await c.query<{
          title: string;
          role: string;
          date_from: string;
          date_to: string;
          slug: string;
        }>(
          `select p.title, p.role, p.date_from, p.date_to, pp.slug
           from proof_pages pp join proofs p on p.id = pp.proof_id
           where pp.user_id=$1 order by p.date_from desc nulls last, pp.published_at desc`,
          [handle.user_id],
        )
      ).rows;
      return { handle: handle.handle, name: profile?.name ?? handle.handle, summary: profile?.summary ?? "", proofs };
    });
  });

export const getSettingsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { requireUser } = await import("@/core/auth/session");
  const { withClient } = await import("@/core/db/client.server");
  const user = await requireUser();
  return withClient(async (c) => {
    const row = (await c.query(`select email, notification_prefs from users where id=$1`, [user.id])).rows[0];
    const handle = (await c.query(`select handle from handles where user_id=$1`, [user.id])).rows[0];
    return { email: row.email, prefs: row.notification_prefs, handle: handle?.handle ?? null };
  });
});
