import { and, eq } from "drizzle-orm"
import {
  ERROR_CODES,
  type PaperId,
  type UserId,
} from "@workspace/domain/kernel"
import {
  nativeProvenance,
  paperDocumentInfoSchema,
  storedPaperDocumentSchema,
  type NativeWriter,
} from "@workspace/domain/paper-doc"
import { getDb } from "../db/context.js"
import { paperDocs } from "../db/schema.js"
import { CommandError } from "../platform/errors.js"
import { admitDocument } from "./content/native-admission.js"

export async function readPaperDocumentInfo(
  userId: UserId,
  docId: PaperId,
  writer?: NativeWriter
) {
  const [row] = await getDb()
    .select()
    .from(paperDocs)
    .where(and(eq(paperDocs.id, docId), eq(paperDocs.userId, userId)))
    .limit(1)
  if (!row) throw new CommandError(ERROR_CODES.NOT_FOUND, "Document not found")
  const document = storedPaperDocumentSchema.parse(row.crdtDocument)
  if (document.kind !== row.kind)
    throw new CommandError(ERROR_CODES.CONFLICT, "Document identity changed")
  admitDocument(document, writer)
  return paperDocumentInfoSchema.parse({
    id: row.id,
    name: row.name,
    kind: row.kind,
    ...(document.version === 4 && document.schemaRevision === 2
      ? {
          format: "rich",
          provenance: nativeProvenance(document),
          updatedAt: row.updatedAt.toISOString(),
        }
      : { format: "prose" }),
  })
}
