import {
  isCvBlockDocument,
  isCvDocument,
  storedPaperDocumentSchema,
  type PaperView,
  type UserId,
} from "@workspace/domain"
import { sql } from "drizzle-orm"

import { getDb } from "../db/context.js"

export function photoRefOf(document: PaperView["document"]) {
  const parsed = storedPaperDocumentSchema.safeParse(document)
  const value = parsed.success ? parsed.data : document
  if (isCvBlockDocument(value)) return value.header.photo
  if (isCvDocument(value)) return value.photoUrl
  return undefined
}

export const PHOTO_DOCUMENT_COLUMNS = [
  { table: "paper_docs", column: "document", source: "paper_docs.document" },
  {
    table: "paper_docs",
    column: "crdt_document",
    source: "paper_docs.crdt_document",
  },
  {
    table: "activity",
    column: "reversal_input",
    source: "activity.reversal_input",
  },
  { table: "activity", column: "result", source: "activity.result" },
  {
    table: "pending_actions",
    column: "input",
    source: "pending_actions.input",
  },
  { table: "idempotency", column: "result", source: "idempotency.result" },
] as const

export const PHOTO_BYTE_SOURCES = [
  { table: "paper_doc_updates", column: "update", source: "paper_doc_updates" },
  { table: "user", column: "image", source: "user.image" },
] as const

export const NOT_PHOTO_JSON = [
  {
    table: "paper_docs",
    column: "checks",
    why: "check notes do not name a photo",
  },
  {
    table: "paper_doc_updates",
    column: "touched",
    why: "block ids, not a document",
  },
  {
    table: "paper_doc_updates",
    column: "rebuilt",
    why: "block ids, not a document",
  },
  { table: "jobs", column: "posting", why: "a job posting, not a CV" },
  {
    table: "inbox_threads",
    column: "draft_times",
    why: "send times, not a document",
  },
  {
    table: "chat_messages",
    column: "parts",
    why: "chat text, not a stored CV",
  },
  {
    table: "activity",
    column: "detail",
    why: "a short note with a name, not a document",
  },
  {
    table: "activity",
    column: "reversal_expect",
    why: "a version stamp, not a document",
  },
] as const

export async function referencedPhotoFileIds(userId: UserId) {
  const result = await getDb().execute<{ file_id: string }>(sql`
    select file_id::text as file_id
    from opencv_app.photo_refs
    where user_id = ${userId}
  `)
  return new Set(result.rows.map((row) => row.file_id))
}
