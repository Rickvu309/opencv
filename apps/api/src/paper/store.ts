import { randomBytes } from "node:crypto"

import {
  DEFAULT_PAPER_DOC_NAME,
  ERROR_CODES,
  PAPER_CONTENT_VERSION,
  decodePaperContent,
  emptyCvDocument,
  emptyLetterDocument,
  parseFileId,
  parsePaperId,
  type PaperView,
  type Actor,
  type FileId,
  type PaperId,
  type PaperReplaceInput,
  type PaperStoredKind,
  type PaperTemplateId,
  type UserId,
} from "@workspace/domain"
import { and, desc, eq } from "drizzle-orm"

import { getDb } from "../db/context.js"
import { files, jobs, paperDocs, paperShares } from "../db/schema.js"
import { createId } from "../id.js"
import { CommandError } from "../registry/errors.js"

const FILE_CAP = 8_000_000
const AVATAR_CAP = 2_000_000

function iso(value: Date) {
  return value.toISOString()
}

// Documents are decoded against their kind on every write, so the jsonb column holds a CV or letter document.
export function toPaper(row: typeof paperDocs.$inferSelect): PaperView {
  return {
    id: parsePaperId(row.id),
    name: row.name,
    kind: row.kind,
    templateId: row.templateId as PaperView["templateId"],
    status: row.status,
    document: row.document as PaperView["document"],
    contentVersion: row.contentVersion,
    checks: row.checks ?? [],
    pageChoice: row.pageChoice,
    sourceFileId: row.sourceFileId ? parseFileId(row.sourceFileId) : null,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  }
}

export async function ownedPaper(userId: UserId, docId: PaperId) {
  const rows = await getDb()
    .select()
    .from(paperDocs)
    .where(and(eq(paperDocs.id, docId), eq(paperDocs.userId, userId)))
    .limit(1)
  const row = rows[0]
  if (!row) throw new CommandError(ERROR_CODES.NOT_FOUND, "Document not found")
  return row
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    const body = Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")
    return `{${body}}`
  }
  return JSON.stringify(value) ?? "null"
}

function requireDocument(kind: PaperStoredKind, document: unknown) {
  const decoded = decodePaperContent(kind, PAPER_CONTENT_VERSION, document)
  if (!decoded.ok) {
    throw new CommandError(ERROR_CODES.VALIDATION_ERROR, decoded.message)
  }
  return decoded.data as Record<string, unknown>
}

function blankDocument(kind: PaperStoredKind) {
  return (kind === "cv" ? emptyCvDocument() : emptyLetterDocument()) as Record<
    string,
    unknown
  >
}

export async function listPapers(
  userId: UserId,
  query?: string,
  kind?: PaperStoredKind
) {
  const rows = await getDb()
    .select()
    .from(paperDocs)
    .where(eq(paperDocs.userId, userId))
    .orderBy(desc(paperDocs.updatedAt))
  const needle = query?.trim().toLowerCase()
  return rows
    .filter((row) => (kind ? row.kind === kind : true))
    .filter((row) => !needle || row.name.toLowerCase().includes(needle))
    .map(toPaper)
}

export async function createPaper(
  actor: Actor,
  input: {
    kind: PaperStoredKind
    name?: string
    templateId?: string
    document?: unknown
  }
) {
  const now = new Date()
  const id = createId(now.getTime())
  const document = input.document
    ? requireDocument(input.kind, input.document)
    : blankDocument(input.kind)
  await getDb()
    .insert(paperDocs)
    .values({
      id,
      userId: actor.userId,
      name: input.name?.trim() || DEFAULT_PAPER_DOC_NAME[input.kind],
      kind: input.kind,
      templateId: input.templateId ?? "simple",
      document,
      contentVersion: 1,
      createdAt: now,
      updatedAt: now,
    })
  return toPaper(await ownedPaper(actor.userId, parsePaperId(id)))
}

export async function replacePaper(actor: Actor, input: PaperReplaceInput) {
  const current = await ownedPaper(actor.userId, input.docId)
  const document = requireDocument(current.kind, input.document)
  const view = toPaper(current)
  if (
    current.contentVersion === input.contentVersion + 1 &&
    canonicalJson(current.document) === canonicalJson(document)
  ) {
    return { ...view, previousDocument: view.document }
  }
  if (current.contentVersion !== input.contentVersion) {
    throw new CommandError(
      ERROR_CODES.CONFLICT,
      "This document changed. Reload it and try again.",
      { document: view }
    )
  }
  const updatedAt = new Date()
  const contentVersion = current.contentVersion + 1
  await getDb()
    .update(paperDocs)
    .set({ document, contentVersion, updatedAt })
    .where(eq(paperDocs.id, current.id))
  return {
    ...toPaper({ ...current, document, contentVersion, updatedAt }),
    previousDocument: view.document,
  }
}

export async function renamePaper(actor: Actor, docId: PaperId, name: string) {
  const current = await ownedPaper(actor.userId, docId)
  const updatedAt = new Date()
  await getDb()
    .update(paperDocs)
    .set({ name, updatedAt })
    .where(eq(paperDocs.id, current.id))
  return {
    ...toPaper({ ...current, name, updatedAt }),
    previousName: current.name,
  }
}

export async function duplicatePaper(actor: Actor, docId: PaperId) {
  const current = await ownedPaper(actor.userId, docId)
  return createPaper(actor, {
    kind: current.kind,
    name: `Copy of ${current.name}`.slice(0, 200),
    templateId: current.templateId ?? undefined,
    document: current.document,
  })
}

export async function deletePaper(actor: Actor, docId: PaperId) {
  await ownedPaper(actor.userId, docId)
  await getDb().delete(paperDocs).where(eq(paperDocs.id, docId))
  return { id: docId }
}

export async function setPaperTemplate(
  actor: Actor,
  docId: PaperId,
  templateId: PaperTemplateId
) {
  const current = await ownedPaper(actor.userId, docId)
  const view = toPaper(current)
  await getDb()
    .update(paperDocs)
    .set({ templateId, updatedAt: new Date() })
    .where(eq(paperDocs.id, current.id))
  return {
    ...toPaper(await ownedPaper(actor.userId, docId)),
    previousTemplateId: view.templateId,
  }
}

export async function setPaperStatus(
  actor: Actor,
  docId: PaperId,
  status: "draft" | "ready" | "published"
) {
  await ownedPaper(actor.userId, docId)
  await getDb()
    .update(paperDocs)
    .set({ status, updatedAt: new Date() })
    .where(eq(paperDocs.id, docId))
  return toPaper(await ownedPaper(actor.userId, docId))
}

export async function sharePaper(actor: Actor, docId: PaperId) {
  await ownedPaper(actor.userId, docId)
  const existing = await getDb()
    .select()
    .from(paperShares)
    .where(eq(paperShares.docId, docId))
    .limit(1)
  if (existing[0]) return { docId, token: existing[0].token }
  const token = randomBytes(24).toString("base64url")
  await getDb().insert(paperShares).values({ id: createId(), docId, token })
  return { docId, token }
}

export async function unsharePaper(actor: Actor, docId: PaperId) {
  await ownedPaper(actor.userId, docId)
  await getDb().delete(paperShares).where(eq(paperShares.docId, docId))
  return { docId }
}

export async function dismissCheck(
  actor: Actor,
  docId: PaperId,
  checkId: string
) {
  const current = await ownedPaper(actor.userId, docId)
  const checks = (current.checks ?? []).filter((check) => check.id !== checkId)
  await getDb()
    .update(paperDocs)
    .set({ checks, updatedAt: new Date() })
    .where(eq(paperDocs.id, docId))
  return toPaper(await ownedPaper(actor.userId, docId))
}

export async function keepTwoPages(actor: Actor, docId: PaperId) {
  await ownedPaper(actor.userId, docId)
  await getDb()
    .update(paperDocs)
    .set({ pageChoice: "keep", updatedAt: new Date() })
    .where(eq(paperDocs.id, docId))
  return toPaper(await ownedPaper(actor.userId, docId))
}

export async function pageCount(actor: Actor, docId: PaperId) {
  const doc = await ownedPaper(actor.userId, docId)
  const weight = JSON.stringify(doc.document).length
  return { docId, pages: weight > 3500 ? 2 : 1, pageChoice: doc.pageChoice }
}

export function renderPdf(name: string) {
  const safe = name.replace(/[()\\]/g, " ").slice(0, 80)
  const stream = `BT /F1 18 Tf 72 720 Td (${safe || "Document"}) Tj ET`
  const body = `%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Count 1 /Kids [3 0 R] >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length ${stream.length} >>stream
${stream}
endstream endobj
5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj
trailer<< /Root 1 0 R >>
%%EOF`
  return Buffer.from(body, "utf8")
}

export async function readShared(token: string) {
  const rows = await getDb()
    .select({ doc: paperDocs })
    .from(paperShares)
    .innerJoin(paperDocs, eq(paperDocs.id, paperShares.docId))
    .where(eq(paperShares.token, token))
    .limit(1)
  const row = rows[0]
  if (!row)
    throw new CommandError(ERROR_CODES.NOT_FOUND, "Share link not found")
  return toPaper(row.doc)
}

const IMPORT_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/json",
])

export async function saveFile(input: {
  userId: UserId
  name: string
  mediaType: string
  bytes: Buffer
  purpose: "import" | "avatar"
}) {
  const cap = input.purpose === "avatar" ? AVATAR_CAP : FILE_CAP
  if (input.bytes.byteLength > cap) {
    throw new CommandError(
      ERROR_CODES.VALIDATION_ERROR,
      input.purpose === "avatar"
        ? "Photo must be 2 MB or smaller."
        : "File must be 8 MB or smaller."
    )
  }
  if (input.purpose === "import" && !IMPORT_TYPES.has(input.mediaType)) {
    throw new CommandError(
      ERROR_CODES.FILE_UNSUPPORTED,
      "Upload a PDF, Word, or text file."
    )
  }
  if (input.purpose === "avatar" && !input.mediaType.startsWith("image/")) {
    throw new CommandError(ERROR_CODES.FILE_UNSUPPORTED, "Upload an image.")
  }
  const id = createId()
  await getDb()
    .insert(files)
    .values({
      id,
      userId: input.userId,
      name: input.name.slice(0, 200) || "file",
      mediaType: input.mediaType,
      byteSize: input.bytes.byteLength,
      purpose: input.purpose,
      bytes: input.bytes,
    })
  return { id }
}

export async function readFileMeta(userId: UserId, fileId: FileId) {
  const rows = await getDb()
    .select({
      id: files.id,
      name: files.name,
      mediaType: files.mediaType,
      byteSize: files.byteSize,
    })
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.userId, userId)))
    .limit(1)
  const row = rows[0]
  if (!row) throw new CommandError(ERROR_CODES.NOT_FOUND, "File not found")
  return { ...row, id: parseFileId(row.id) }
}

export async function listFiles(userId: UserId) {
  const rows = await getDb()
    .select({
      id: files.id,
      name: files.name,
      mediaType: files.mediaType,
      byteSize: files.byteSize,
      createdAt: files.createdAt,
    })
    .from(files)
    .where(eq(files.userId, userId))
    .orderBy(desc(files.createdAt))
  return rows.map((row) => ({
    id: parseFileId(row.id),
    name: row.name,
    mediaType: row.mediaType,
    byteSize: row.byteSize,
    createdAt: iso(row.createdAt),
  }))
}

export async function deleteFile(actor: Actor, fileId: FileId) {
  await readFileMeta(actor.userId, fileId)
  await getDb()
    .delete(files)
    .where(and(eq(files.id, fileId), eq(files.userId, actor.userId)))
  return { fileId }
}

export async function importPaper(actor: Actor, fileId: FileId) {
  const rows = await getDb()
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.userId, actor.userId)))
    .limit(1)
  const file = rows[0]
  if (!file || file.purpose !== "import") {
    throw new CommandError(ERROR_CODES.NOT_FOUND, "Import file not found")
  }
  let document = blankDocument("cv")
  if (
    file.mediaType === "application/json" ||
    file.mediaType === "text/plain"
  ) {
    const text = file.bytes.toString("utf8")
    try {
      document = requireDocument("cv", JSON.parse(text) as unknown)
    } catch {
      document = blankDocument("cv")
    }
  }
  const created = await createPaper(actor, {
    kind: "cv",
    name: file.name.replace(/\.[^.]+$/, "") || DEFAULT_PAPER_DOC_NAME.cv,
    document,
  })
  await getDb()
    .update(paperDocs)
    .set({
      sourceFileId: file.id,
      checks:
        file.mediaType === "text/plain" || file.mediaType === "application/json"
          ? []
          : [
              {
                id: "import",
                kind: "import",
                message: "Imported file needs a read.",
              },
            ],
    })
    .where(eq(paperDocs.id, created.id))
  return toPaper(await ownedPaper(actor.userId, parsePaperId(created.id)))
}

export async function linkedJobId(docId: PaperId) {
  const rows = await getDb()
    .select({
      id: jobs.id,
      cvDocId: jobs.cvDocId,
      letterDocId: jobs.letterDocId,
    })
    .from(jobs)
    .where(eq(jobs.cvDocId, docId))
    .limit(1)
  if (rows[0]) return rows[0].id
  const letters = await getDb()
    .select({ id: jobs.id })
    .from(jobs)
    .where(eq(jobs.letterDocId, docId))
    .limit(1)
  return letters[0]?.id ?? null
}
