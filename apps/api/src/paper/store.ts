import { AsyncLocalStorage } from "node:async_hooks"
import { randomBytes } from "node:crypto"

import {
  DEFAULT_PAPER_DOC_NAME,
  ERROR_CODES,
  IMPORT_PAGES_MESSAGE,
  PAPER_CONTENT_VERSION,
  decodePaperContent,
  blankBlockDocument,
  compactLetterDocument,
  emptyLetterDocument,
  isCvBlockDocument,
  isCvDocument,
  paperPhotoFileId,
  paperPhotoRef,
  parseFileId,
  parsePaperId,
  parseUserId,
  type PaperView,
  type Actor,
  type FileId,
  type LetterDocument,
  type PaperId,
  type PaperReplaceInput,
  type PaperStoredKind,
  type PaperTemplateId,
  type UserId,
} from "@workspace/domain"
import { and, desc, eq } from "drizzle-orm"

import { getDb } from "../db/context.js"
import { files, paperDocs, paperShares } from "../db/schema.js"
import { createId } from "../id.js"
import { CommandError } from "../registry/errors.js"
import {
  IMPORT_FAILED_MESSAGE,
  IMPORT_GENERIC_MESSAGE,
  classifyImport,
  importParsers,
  mediaTypeForImport,
  parseImportFile,
} from "./import-parse.js"

import { photoRefOf, referencedPhotoFileIds } from "./photo-references.js"

const importAbort = new AsyncLocalStorage<AbortSignal>()

export function withImportSignal<T>(
  signal: AbortSignal,
  run: () => Promise<T>
) {
  return importAbort.run(signal, run)
}

export const IMPORT_FILE_CAP = 8_000_000
export const IMPORT_SIZE_MESSAGE = "File must be 8 MB or smaller."
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
    isFavorite: row.isFavorite,
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
  // A letter never stores an empty or blank part, whoever writes it.
  if (kind === "letter") {
    return compactLetterDocument(decoded.data as LetterDocument) as Record<
      string,
      unknown
    >
  }
  return decoded.data as Record<string, unknown>
}

function blankDocument(kind: PaperStoredKind) {
  return (
    kind === "cv" ? blankBlockDocument() : emptyLetterDocument()
  ) as Record<string, unknown>
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
  const document =
    input.document !== undefined
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
  importParsers.onInsert?.()
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
  // A stored version 2 CV stays on blocks. A version 1 row may still adopt version 2.
  if (
    current.kind === "cv" &&
    isCvBlockDocument(current.document) &&
    !isCvBlockDocument(document)
  ) {
    throw new CommandError(
      ERROR_CODES.VALIDATION_ERROR,
      "This CV uses blocks. Send a version 2 document."
    )
  }
  const updatedAt = new Date()
  const contentVersion = current.contentVersion + 1
  const written = await getDb()
    .update(paperDocs)
    .set({ document, contentVersion, updatedAt })
    .where(
      and(
        eq(paperDocs.id, current.id),
        eq(paperDocs.contentVersion, input.contentVersion)
      )
    )
  if ((written.rowCount ?? 0) === 0) {
    const latest = toPaper(await ownedPaper(actor.userId, input.docId))
    throw new CommandError(
      ERROR_CODES.CONFLICT,
      "This document changed. Reload it and try again.",
      { document: latest }
    )
  }
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

export async function setPaperFavorite(
  userId: UserId,
  docId: PaperId,
  isFavorite: boolean
) {
  const rows = await getDb()
    .update(paperDocs)
    .set({ isFavorite })
    .where(and(eq(paperDocs.id, docId), eq(paperDocs.userId, userId)))
    .returning({ id: paperDocs.id })
  if (!rows[0])
    throw new CommandError(ERROR_CODES.NOT_FOUND, "Document not found")
  return { docId, isFavorite }
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
  // Coach estimate from the stored JSON. The editor counts pages from the preview.
  const weight = JSON.stringify(doc.document).length
  return { docId, pages: weight > 3500 ? 2 : 1, pageChoice: doc.pageChoice }
}

function withPhotoRef(document: PaperView["document"], ref: string) {
  if (isCvBlockDocument(document)) {
    return { ...document, header: { ...document.header, photo: ref } }
  }
  if (isCvDocument(document)) return { ...document, photoUrl: ref }
  throw new CommandError(
    ERROR_CODES.VALIDATION_ERROR,
    "A photo belongs on a CV."
  )
}

async function requireAvatarFile(userId: UserId, fileId: FileId) {
  const rows = await getDb()
    .select({
      purpose: files.purpose,
      mediaType: files.mediaType,
    })
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.userId, userId)))
    .limit(1)
  const row = rows[0]
  if (!row || row.purpose !== "avatar" || !row.mediaType.startsWith("image/")) {
    throw new CommandError(ERROR_CODES.NOT_FOUND, "Photo file not found")
  }
  return row
}

export async function readOwnedPhoto(userId: UserId, fileId: FileId) {
  const meta = await requireAvatarFile(userId, fileId)
  const rows = await getDb()
    .select({ bytes: files.bytes })
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.userId, userId)))
    .limit(1)
  const bytes = rows[0]?.bytes
  if (!bytes) throw new CommandError(ERROR_CODES.NOT_FOUND, "Photo not found")
  return { mediaType: meta.mediaType, bytes }
}

export async function readSharedPhoto(token: string) {
  const rows = await getDb()
    .select({ doc: paperDocs })
    .from(paperShares)
    .innerJoin(paperDocs, eq(paperDocs.id, paperShares.docId))
    .where(eq(paperShares.token, token))
    .limit(1)
  const row = rows[0]
  if (!row) throw new CommandError(ERROR_CODES.NOT_FOUND, "Photo not found")
  const fileId = paperPhotoFileId(photoRefOf(toPaper(row.doc).document))
  if (!fileId) throw new CommandError(ERROR_CODES.NOT_FOUND, "Photo not found")
  return readOwnedPhoto(parseUserId(row.doc.userId), parseFileId(fileId))
}

export async function attachPhoto(
  actor: Actor,
  docId: PaperId,
  fileId: FileId
) {
  const current = await ownedPaper(actor.userId, docId)
  await requireAvatarFile(actor.userId, fileId)
  const view = toPaper(current)
  const document = requireDocument(
    current.kind,
    withPhotoRef(view.document, paperPhotoRef(fileId))
  )
  const updatedAt = new Date()
  const contentVersion = current.contentVersion + 1
  const written = await getDb()
    .update(paperDocs)
    .set({ document, contentVersion, updatedAt })
    .where(
      and(
        eq(paperDocs.id, current.id),
        eq(paperDocs.contentVersion, current.contentVersion)
      )
    )
  if ((written.rowCount ?? 0) === 0) {
    throw new CommandError(
      ERROR_CODES.CONFLICT,
      "This document changed. Reload it and try again."
    )
  }
  return {
    ...toPaper({ ...current, document, contentVersion, updatedAt }),
    previousDocument: view.document,
  }
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
  const { isFavorite: _isFavorite, ...shared } = toPaper(row.doc)
  void _isFavorite
  return shared
}

/** Type comes from the bytes. The client Content-Type is not trusted. */
function avatarMediaType(bytes: Buffer) {
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png"
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg"
  }
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp"
  }
  if (bytes.length >= 6) {
    const sig = bytes.toString("ascii", 0, 6)
    if (sig === "GIF87a" || sig === "GIF89a") return "image/gif"
  }
  throw new CommandError(ERROR_CODES.FILE_UNSUPPORTED, "Upload an image.")
}

export async function saveFile(input: {
  userId: UserId
  name: string
  mediaType: string
  bytes: Buffer
  purpose: "import" | "avatar"
}) {
  const cap = input.purpose === "avatar" ? AVATAR_CAP : IMPORT_FILE_CAP
  if (input.bytes.byteLength > cap) {
    throw new CommandError(
      ERROR_CODES.VALIDATION_ERROR,
      input.purpose === "avatar"
        ? "Photo must be 2 MB or smaller."
        : IMPORT_SIZE_MESSAGE
    )
  }
  let mediaType = input.mediaType
  if (input.purpose === "import") {
    const kind = classifyImport({
      name: input.name,
      mediaType: input.mediaType,
      bytes: input.bytes,
    })
    if (kind === "pages" || kind === "unknown") {
      throw new CommandError(
        ERROR_CODES.FILE_UNSUPPORTED,
        kind === "pages" ? IMPORT_PAGES_MESSAGE : IMPORT_GENERIC_MESSAGE
      )
    }
    mediaType = mediaTypeForImport(kind)
  }
  const storedType =
    input.purpose === "avatar" ? avatarMediaType(input.bytes) : mediaType
  const id = createId()
  await getDb()
    .insert(files)
    .values({
      id,
      userId: input.userId,
      name: input.name.slice(0, 200) || "file",
      mediaType: storedType,
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
  if ((await referencedPhotoFileIds(actor.userId)).has(fileId)) {
    throw new CommandError(
      ERROR_CODES.CONFLICT,
      "This photo is still in use by a CV, your profile, or Undo."
    )
  }
  await getDb()
    .delete(files)
    .where(and(eq(files.id, fileId), eq(files.userId, actor.userId)))
  return { fileId }
}

async function removeImportFile(userId: UserId, fileId: string) {
  await getDb()
    .delete(files)
    .where(and(eq(files.id, fileId), eq(files.userId, userId)))
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
  let parsed: Awaited<ReturnType<typeof parseImportFile>>
  try {
    parsed = await parseImportFile({
      name: file.name,
      mediaType: file.mediaType,
      bytes: file.bytes,
    })
  } catch {
    await removeImportFile(actor.userId, file.id)
    throw new CommandError(ERROR_CODES.VALIDATION_ERROR, IMPORT_FAILED_MESSAGE)
  }
  if (!parsed.ok) {
    await removeImportFile(actor.userId, file.id)
    throw new CommandError(
      parsed.code === "LINK_UNREADABLE"
        ? ERROR_CODES.LINK_UNREADABLE
        : ERROR_CODES.FILE_UNSUPPORTED,
      parsed.message
    )
  }
  const giveUp = async (docId?: string) => {
    if (docId) {
      await getDb().delete(paperDocs).where(eq(paperDocs.id, docId))
    }
    await removeImportFile(actor.userId, file.id)
    throw new CommandError(ERROR_CODES.VALIDATION_ERROR, IMPORT_FAILED_MESSAGE)
  }
  if (importAbort.getStore()?.aborted) await giveUp()
  let created: PaperView
  try {
    created = await createPaper(actor, {
      kind: "cv",
      name: file.name.replace(/\.[^.]+$/, "") || DEFAULT_PAPER_DOC_NAME.cv,
      document: parsed.document,
    })
  } catch (error) {
    await removeImportFile(actor.userId, file.id)
    throw error
  }
  if (importAbort.getStore()?.aborted) await giveUp(created.id)
  await getDb()
    .update(paperDocs)
    .set({
      sourceFileId: file.id,
      checks: [
        {
          id: "source-file",
          kind: "source",
          message: file.name,
          blockId: "",
          resolved: true,
        },
        ...parsed.checks,
      ],
    })
    .where(eq(paperDocs.id, created.id))
  return toPaper(await ownedPaper(actor.userId, parsePaperId(created.id)))
}
