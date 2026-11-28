import { and, eq } from "drizzle-orm"
import {
  ERROR_CODES,
  type PaperId,
  type UserId,
} from "@workspace/domain/kernel"
import {
  emptyRichPaper,
  nativeProvenance,
  paperDocumentInfoSchema,
  storedPaperDocumentSchema,
} from "@workspace/domain/paper-doc"
import { getDb } from "../db/context.js"
import { paperDocs } from "../db/schema.js"
import { CommandError } from "../platform/errors.js"
import { NEW_ENGINE } from "./log/index.js"

export async function readPaperDocumentInfo(userId: UserId, docId: PaperId) {
  const [row] = await getDb()
    .select()
    .from(paperDocs)
    .where(and(eq(paperDocs.id, docId), eq(paperDocs.userId, userId)))
    .limit(1)
  if (!row || row.engine !== NEW_ENGINE)
    throw new CommandError(ERROR_CODES.NOT_FOUND, "Document not found")
  return paperDocumentInfoSchema.parse({
    id: row.id,
    name: row.name,
    kind: row.kind,
    format: "rich",
    provenance: nativeProvenance(
      storedPaperDocumentSchema.parse(emptyRichPaper(row.kind))
    ),
    updatedAt: row.updatedAt.toISOString(),
  })
}
