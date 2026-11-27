import {
  ERROR_CODES,
  parseFileId,
  parsePaperId,
  type Actor,
  type FileId,
  type PaperId,
  type UserId,
} from "@workspace/domain/kernel"
import {
  DEFAULT_PAPER_DOC_NAME,
  IMPORT_PAGES_MESSAGE,
  emptyRichPaper,
  RICH_NATIVE_WRITER,
  richPaperDocumentSchema,
  type NativeWriter,
  type PaperStoredKind,
} from "@workspace/domain/paper-doc"
import { and, desc, eq, ne } from "drizzle-orm"

import { getDb, insideTransaction } from "../db/context.js"
import { files, paperDocs } from "../db/schema.js"
import { trashStoredWordPage } from "./word-page-trash.js"
import { createId } from "../platform/id.js"
import { CommandError } from "../platform/errors.js"
import { admitDocument } from "./content/native-admission.js"
import {
  IMPORT_GENERIC_MESSAGE,
  classifyImport,
  importParsers,
  mediaTypeForImport,
} from "./import/import-parse.js"

import { seedColumns } from "./content/content-store.js"
import {
  dropServerReleasedPhoto,
  referencedPhotoFileIds,
} from "./photo-references.js"
import {
  isRichPaper,
  toListedPaper,
  tryReadRichPaper,
} from "./content/read-paper.js"
import { readPaperDocumentInfo } from "./document-info.js"

export const IMPORT_FILE_CAP = 8_000_000
export const IMPORT_SIZE_MESSAGE = "File must be 8 MB or smaller."
export const AVATAR_CAP = 2_000_000

function iso(value: Date) {
  return value.toISOString()
}

export { toListedPaper, tryReadRichPaper }

function documentNotFound(): never {
  throw new CommandError(ERROR_CODES.NOT_FOUND, "Document not found")
}

export async function ownedPaperOrNull(userId: UserId, docId: PaperId) {
  const rows = await getDb()
    .select()
    .from(paperDocs)
    .where(and(eq(paperDocs.id, docId), eq(paperDocs.userId, userId)))
    .limit(1)
  return rows[0] ?? null
}

function listedForEditor(
  row: typeof paperDocs.$inferSelect,
  writer?: NativeWriter
) {
  if (!writer) return []
  try {
    return [toListedPaper(row, writer)]
  } catch (error) {
    if (error instanceof CommandError) return []
    throw error
  }
}

export async function listPapers(
  userId: UserId,
  query?: string,
  kind?: PaperStoredKind,
  writer?: NativeWriter
) {
  const rows = await getDb()
    .select()
    .from(paperDocs)
    .where(eq(paperDocs.userId, userId))
    .orderBy(desc(paperDocs.updatedAt))
  const needle = query?.trim().toLowerCase()
  const stored = rows
    .filter((row) => (kind ? row.kind === kind : true))
    .filter((row) => !needle || row.name.toLowerCase().includes(needle))
    .flatMap((row) => (isRichPaper(row) ? listedForEditor(row, writer) : []))
  return [...stored].sort((left, right) =>
    left.updatedAt < right.updatedAt
      ? 1
      : left.updatedAt > right.updatedAt
        ? -1
        : 0
  )
}

export async function createPaper(
  actor: Actor,
  input: {
    kind: PaperStoredKind
    name?: string
    templateId?: string
    paper?: unknown
    id?: string
    createdAt?: Date
  },
  writer: NativeWriter = RICH_NATIVE_WRITER
) {
  const now = new Date()
  const id = input.id ?? createId(now.getTime())
  const paper = richPaperDocumentSchema.parse(
    input.paper ?? emptyRichPaper(input.kind)
  )
  if (paper.kind !== input.kind)
    throw new CommandError(
      ERROR_CODES.CONFLICT,
      "The document kind does not match."
    )
  admitDocument(paper, writer)
  await getDb()
    .insert(paperDocs)
    .values({
      id,
      userId: actor.userId,
      name: input.name?.trim() || DEFAULT_PAPER_DOC_NAME[input.kind],
      kind: input.kind,
      templateId: input.templateId ?? "simple",
      ...seedColumns(input.kind, paper),
      crdtBaseSeq: 1,
      contentVersion: 1,
      createdAt: input.createdAt ?? now,
      updatedAt: now,
    })
    .onConflictDoNothing()
  importParsers.onInsert?.()
  const row = (await ownedPaperOrNull(actor.userId, parsePaperId(id))) ?? null
  if (!row) return documentNotFound()
  return readPaperDocumentInfo(actor.userId, parsePaperId(id), writer)
}

export async function createEngineImportPage(
  owner: UserId,
  input: { fileId: FileId; name: string; kind: PaperStoredKind }
) {
  const id = createId()
  await getDb().insert(paperDocs).values({
    id,
    userId: owner,
    name: input.name,
    kind: input.kind,
    contentVersion: 1,
    sourceFileId: input.fileId,
  })
  return id
}

export type PaperPatch = {
  name?: string
  isFavorite?: boolean
  status?: "draft" | "ready" | "published"
}

export async function updatePaper(
  actor: Actor,
  docId: PaperId,
  patch: PaperPatch,
  writer?: NativeWriter
) {
  const current = await ownedPaperOrNull(actor.userId, docId)
  if (!current) return documentNotFound()
  toListedPaper(current, writer)
  const touchesPage = patch.name !== undefined || patch.status !== undefined
  const next = {
    ...current,
    ...patch,
    ...(touchesPage ? { updatedAt: new Date() } : {}),
  }
  await getDb()
    .update(paperDocs)
    .set({
      ...patch,
      ...(touchesPage ? { updatedAt: next.updatedAt } : {}),
    })
    .where(eq(paperDocs.id, current.id))
  const previous: PaperPatch = {
    ...(patch.name !== undefined ? { name: current.name } : {}),
    ...(patch.isFavorite !== undefined
      ? { isFavorite: current.isFavorite }
      : {}),
    ...(patch.status !== undefined ? { status: current.status } : {}),
  }
  return { ...toListedPaper(next, writer), previous }
}

export type DuplicatePlan = { kind: "block" } | { kind: "missing" }

export async function planDuplicate(
  actor: Actor,
  docId: PaperId
): Promise<DuplicatePlan> {
  return (await ownedPaperOrNull(actor.userId, docId))
    ? { kind: "block" }
    : { kind: "missing" }
}

async function copyOfRichPaper(
  actor: Actor,
  source: typeof paperDocs.$inferSelect,
  writer?: NativeWriter
) {
  toListedPaper(source, writer)
  const created = await createPaper(
    actor,
    {
      kind: source.kind,
      name: `Copy of ${source.name}`.slice(0, 200),
      templateId: source.templateId ?? undefined,
      paper: source.crdtDocument,
    },
    writer
  )
  const copy =
    (await ownedPaperOrNull(actor.userId, parsePaperId(created.id))) ??
    documentNotFound()
  return toListedPaper(copy, writer)
}

export async function duplicatePaper(
  actor: Actor,
  docId: PaperId,
  plan: DuplicatePlan,
  writer?: NativeWriter
) {
  if (plan.kind === "missing") return documentNotFound()
  const source =
    (await ownedPaperOrNull(actor.userId, docId)) ?? documentNotFound()
  return copyOfRichPaper(actor, source, writer)
}

export async function deletePaper(actor: Actor, docId: PaperId) {
  if (!(await ownedPaperOrNull(actor.userId, docId))) return documentNotFound()
  await trashStoredWordPage(actor.userId, docId)
  await getDb().delete(paperDocs).where(eq(paperDocs.id, docId))
  return { id: docId }
}

export async function readOwnedPhoto(
  userId: UserId,
  fileId: FileId,
  options?: { lock: true }
) {
  if (options?.lock && !insideTransaction())
    throw new CommandError(
      ERROR_CODES.CONFLICT,
      "Photo download must own its snapshot"
    )
  const query = getDb()
    .select({
      purpose: files.purpose,
      mediaType: files.mediaType,
      bytes: files.bytes,
    })
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.userId, userId)))
    .limit(1)
  const rows = await (options?.lock ? query.for("share") : query)
  const row = rows[0]
  if (!row || row.purpose !== "avatar" || !row.mediaType.startsWith("image/"))
    throw new CommandError(ERROR_CODES.NOT_FOUND, "Photo file not found")
  return { mediaType: row.mediaType, bytes: row.bytes }
}

export function mediaTypeFromImageBytes(bytes: Buffer) {
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
  id?: string
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
    input.purpose === "avatar"
      ? mediaTypeFromImageBytes(input.bytes)
      : mediaType
  const id = input.id ?? createId()
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
    .onConflictDoNothing()
  return { id }
}

export async function readImportFile(userId: UserId, fileId: FileId) {
  const [file] = await getDb()
    .select({ bytes: files.bytes, mediaType: files.mediaType })
    .from(files)
    .where(
      and(
        eq(files.id, fileId),
        eq(files.userId, userId),
        eq(files.purpose, "import")
      )
    )
    .limit(1)
  if (!file) throw new CommandError(ERROR_CODES.NOT_FOUND, "File not found")
  return file
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
    .where(
      and(
        eq(files.id, fileId),
        eq(files.userId, userId),
        ne(files.purpose, "package")
      )
    )
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
    .where(and(eq(files.userId, userId), ne(files.purpose, "package")))
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
  await dropServerReleasedPhoto(actor.userId, fileId)
  await getDb()
    .delete(files)
    .where(and(eq(files.id, fileId), eq(files.userId, actor.userId)))
  return { fileId }
}
