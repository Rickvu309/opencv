import { createServerFn } from "@tanstack/react-start";
import { nextApplicationStep } from "@/core/copy";

export const listApplicationsFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const { requireUser } = await import("@/core/auth/session");
    const { withClient } = await import("@/core/db/client.server");
    const user = await requireUser();
    const { rows } = await withClient((c) =>
      c.query(
        `select a.*, o.fit,
                (select p.id from papers p where p.user_id=a.user_id and p.kind='cv' and p.source_paper_id is null
                 order by p.updated_at desc limit 1) as master_cv_id
         from applications a
         left join openings o on o.id = a.opening_id
         where a.user_id=$1 order by a.updated_at desc`,
        [user.id],
      ),
    );
    return rows.map((row) => ({
      id: String(row.id),
      role: String(row.role ?? ""),
      company: String(row.company ?? ""),
      status: String(row.status),
      nextStep: nextApplicationStep(String(row.status)),
      cv_paper_id: (row.cv_paper_id as string | null) ?? null,
      master_cv_id: (row.master_cv_id as string | null) ?? null,
    }));
  },
);
