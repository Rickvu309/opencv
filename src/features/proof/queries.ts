import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";

export const listProofsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { requireUser } = await import("@/core/auth/session");
  const { withClient } = await import("@/core/db/client.server");
  const user = await requireUser();
  const { rows } = await withClient((c) =>
    c.query<{
      id: string;
      title: string;
      role: string;
      status: string;
      date_from: string | null;
      date_to: string | null;
    }>(
      `select id, title, role, date_from, date_to, status, updated_at from proofs
       where user_id=$1 order by updated_at desc`,
      [user.id],
    ),
  );
  return rows;
});

export const getProofFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async (ctx) => {
    const data = ctx.data as { id: string };
    const { requireUser } = await import("@/core/auth/session");
    const { withClient } = await import("@/core/db/client.server");
    const user = await requireUser();
    return withClient(async (c) => {
      const proof = (
        await c.query(`select * from proofs where id=$1 and user_id=$2`, [data.id, user.id])
      ).rows[0];
      if (!proof) return null;
      const entries = (
        await c.query(
          `select * from proof_entries where proof_id=$1 order by created_at desc`,
          [data.id],
        )
      ).rows;
      const page = (
        await c.query(`select slug from proof_pages where proof_id=$1`, [data.id])
      ).rows[0];
      return { ...proof, entries, slug: page?.slug ?? null };
    });
  });

export const interviewFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async (ctx) => {
    const data = ctx.data as { id: string };
    const { requireUser } = await import("@/core/auth/session");
    const { interviewQuestion } = await import("@/features/proof/ai.server");
    const user = await requireUser();
    const proof = await getProofFn({ data });
    if (!proof) return "";
    return interviewQuestion(user.id, proof.title, proof.entries);
  });

export const arrangeFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async (ctx) => {
    const data = ctx.data as { id: string };
    const { requireUser } = await import("@/core/auth/session");
    const { arrangeStory } = await import("@/features/proof/ai.server");
    const user = await requireUser();
    const proof = await getProofFn({ data });
    if (!proof) return null;
    return arrangeStory(user.id, proof.title, proof.entries);
  });
