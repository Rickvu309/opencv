import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { paperContentSchema, typeWord } from "@/features/paper/model";

export const listPapersFn = createServerFn({ method: "GET" }).handler(async () => {
  const { requireUser } = await import("@/core/auth/session");
  const { loadPaperCanvas } = await import("@/features/paper/load.server");
  const user = await requireUser();
  return loadPaperCanvas(user.id);
});

export const getPaperFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async (ctx) => {
    const data = ctx.data as { id: string };
    const { requireUser } = await import("@/core/auth/session");
    const { withClient } = await import("@/core/db/client.server");
    const { loadPublishedProofLines } = await import("@/features/paper/load.server");
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
      publishedLines: await loadPublishedProofLines(user.id),
    };
  });
