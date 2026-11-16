import type { TestDatabase } from "../db/context.js"
import { paperDocs } from "../db/schema.js"

export async function insertPaperFixture(
  db: TestDatabase,
  row: typeof paperDocs.$inferInsert
) {
  await db.insert(paperDocs).values(row)
}
