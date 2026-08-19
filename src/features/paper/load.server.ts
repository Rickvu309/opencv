import { withClient } from "@/core/db/client.server";
import { paperContentSchema, typeWord } from "@/features/paper/model";

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
