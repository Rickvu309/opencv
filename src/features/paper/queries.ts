import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { paperContentSchema, typeWord } from "@/features/paper/model";

export const listPapersFn = createServerFn({ method: "GET" }).handler(async () => {
  const { requireUser } = await import("@/core/auth/session");
  const { withClient } = await import("@/core/db/client.server");
  const user = await requireUser();
  const papers = (
    await withClient((c) =>
      c.query(
        `select id, kind, title, template, updated_at from papers where user_id=$1 order by updated_at desc`,
        [user.id],
      ),
    )
  ).rows.map((p) => ({
    id: String(p.id),
    title: String(p.title),
    kind: String(p.kind),
    template: String(p.template),
        updated_at: String(p.updated_at),
        typeWord: typeWord(String(p.kind), String(p.template)),
      }));
  const files = (
    await withClient((c) =>
      c.query<{ id: string; filename: string; created_at: Date | string }>(
        `select id, filename, created_at from files where user_id=$1 and purpose='upload' order by created_at desc`,
        [user.id],
      ),
    )
  ).rows.map((f) => ({
    id: String(f.id),
    filename: String(f.filename),
    created_at: String(f.created_at),
  }));
  return { papers, files };
});

export const getPaperFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async (ctx) => {
    const data = ctx.data as { id: string };
    const { requireUser } = await import("@/core/auth/session");
    const { withClient } = await import("@/core/db/client.server");
    const user = await requireUser();
    const { rows } = await withClient((c) =>
      c.query(`select * from papers where id=$1 and user_id=$2`, [data.id, user.id]),
    );
    const row = rows[0];
    if (!row) return null;
    return {
      ...row,
      content: paperContentSchema.parse(row.content ?? {}),
      typeWord: typeWord(row.kind, row.template),
    };
  });
