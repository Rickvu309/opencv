import { createServerFn } from "@tanstack/react-start";

export const listOpeningsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { requireUser } = await import("@/core/auth/session");
  const { withClient } = await import("@/core/db/client.server");
  const { loadProfile } = await import("@/features/profile/load.server");
  const user = await requireUser();
  const profile = await loadProfile(user.id);
  const thin = !profile.targetRole;
  const { rows } = await withClient((c) =>
    c.query(
      `select id, title, company, location, url, requirements, fit, created_at
       from openings where user_id=$1
       order by coalesce((fit->>'met')::int, 0) desc, created_at desc`,
      [user.id],
    ),
  );
  return { openings: rows, thin };
});
