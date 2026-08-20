import { withClient } from "@/core/db/client.server";
import {
  cvLineFromPublishedProof,
  emptyCv,
  paperCanvas,
  paperContentSchema,
  typeWord,
  type PaperCanvas,
  type PaperContent,
  type PublishedProofLine,
} from "@/features/paper/model";
import { proofPageContentSchema } from "@/features/proof/model";

export async function loadPaper(userId: string, id: string) {
  return withClient(async (c) => {
    const { rows } = await c.query(
      `select id, kind, title, template, content from papers where id=$1 and user_id=$2`,
      [id, userId],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      id: String(row.id),
      kind: String(row.kind),
      title: String(row.title),
      template: String(row.template),
      typeWord: typeWord(String(row.kind), String(row.template)),
      content: paperContentSchema.parse(row.content ?? {}),
    };
  });
}

export async function loadPublishedProofLines(userId: string): Promise<PublishedProofLine[]> {
  const { rows } = await withClient((c) =>
    c.query<{ content: unknown }>(
      `select content from proof_pages where user_id=$1 order by published_at desc`,
      [userId],
    ),
  );
  return rows
    .map((row) => cvLineFromPublishedProof(proofPageContentSchema.parse(row.content ?? {})))
    .filter((line): line is PublishedProofLine => line !== null);
}

export async function loadPaperCanvas(
  userId: string,
): Promise<(PaperCanvas & { content: PaperContent })> {
  return withClient(async (c) => {
    const cv = (
      await c.query<{ id: string; content: unknown }>(
        `select id, content from papers
          where user_id=$1 and kind='cv'
          order by updated_at desc
          limit 1`,
        [userId],
      )
    ).rows[0];
    const pages = (
      await c.query<{ content: unknown }>(
        `select content from proof_pages where user_id=$1 order by published_at desc`,
        [userId],
      )
    ).rows;
    const published = pages.map((row) => proofPageContentSchema.parse(row.content ?? {}));
    const canvas = paperCanvas({
      cvId: cv ? String(cv.id) : null,
      published,
    });
    return {
      ...canvas,
      content: cv ? paperContentSchema.parse(cv.content ?? {}) : emptyCv(),
    };
  });
}
