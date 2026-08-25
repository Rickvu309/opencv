import { ERROR_CODES, type PaperDoc } from "@workspace/domain"
import { desc, eq } from "drizzle-orm"

import { CommandError, type AppDatabase } from "../commands/registry.js"
import { paperDocs } from "../db/schema.js"

function iso(value: Date) {
  return value.toISOString()
}

export function toPaperDoc(row: {
  id: string
  name: string
  contentKind: "cv" | "letter" | "proof"
  status: "draft" | "ready" | "published"
  content: unknown
  contentVersion: number
  applyCardId: string | null
  createdAt: Date
  updatedAt: Date
}): PaperDoc {
  return {
    id: row.id,
    name: row.name,
    kind: row.contentKind,
    status: row.status,
    content: row.content,
    contentVersion: row.contentVersion,
    applyCardId: row.applyCardId,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  }
}

export async function listPaperDocsForUser(
  db: AppDatabase,
  userId: string
): Promise<PaperDoc[]> {
  const rows = await db
    .select()
    .from(paperDocs)
    .where(eq(paperDocs.userId, userId))
    .orderBy(desc(paperDocs.updatedAt), desc(paperDocs.id))

  return rows.map(toPaperDoc)
}

export async function getOwnedPaperDoc(
  db: AppDatabase,
  userId: string,
  docId: string
) {
  const [row] = await db
    .select()
    .from(paperDocs)
    .where(eq(paperDocs.id, docId))
    .limit(1)

  if (!row) {
    throw new CommandError(ERROR_CODES.NOT_FOUND, "Paper doc not found")
  }
  if (row.userId !== userId) {
    throw new CommandError(
      ERROR_CODES.FORBIDDEN,
      "You cannot access this Paper doc"
    )
  }

  return row
}

export async function getPaperDocDetail(
  db: AppDatabase,
  userId: string,
  docId: string
): Promise<PaperDoc> {
  const row = await getOwnedPaperDoc(db, userId, docId)
  return toPaperDoc(row)
}
