import { randomBytes } from "node:crypto"

import {
  DEFAULT_PAPER_DOC_NAME,
  ERROR_CODES,
  IMPORT_PAGES_MESSAGE,
  blankCv,
  blankLetter,
  paperNodeSpecs,
  paperDocumentSchema,
  legacyPaperDocumentSchema,
  paperPhotoFileId,
  paperPhotoRef,
  parseFileId,
  parsePaperId,
  parseUserId,
  storedPaperDocumentSchema,
  type PaperDocument,
  type NativeWriter,
  type Actor,
  type FileId,
  type PaperId,
  type PaperStoredKind,
  type PaperTemplateId,
  type UserId,
} from "@workspace/domain"
import { and, desc, eq, ne } from "drizzle-orm"

import { getDb, insideTransaction } from "../db/context.js"
import { files, paperDocs, paperShares } from "../db/schema.js"
import { createId } from "../platform/id.js"
import { CommandError } from "../platform/errors.js"
import { admitDocument } from "./native-admission.js"
import { listPackagePapers } from "./package-list.js"
import {
  deleteWordPage,
  publishWordPageCopy,
  renameWordPage,
  restoreWordPage,
  stageWordPageCopy,
  type WordPageCopy,
} from "./package-card-actions.js"
import {
  IMPORT_GENERIC_MESSAGE,
  classifyImport,
  importParsers,
  mediaTypeForImport,
} from "./import-parse.js"

import { seedColumns, withContent } from "./content-store.js"
import {
  dropServerReleasedPhoto,
  referencedPhotoFileIds,
} from "./photo-references.js"
import {
  isRichPaper,
  readStoredPaper,
  toListedPaper,
  toPaper,
  toSharedPaper,
  tryReadStoredPaper,
} from "./read-paper.js"
import { readPaperDocumentInfo } from "./document-info.js"

export const IMPORT_FILE_CAP = 8_000_000
export const IMPORT_SIZE_MESSAGE = "File must be 8 MB or smaller."
const AVATAR_CAP = 2_000_000

function iso(value: Date) {
  return value.toISOString()
}

export { toPaper, tryReadStoredPaper }

function documentNotFound(): never {
  throw new CommandError(ERROR_CODES.NOT_FOUND, "Document not found")
}

async function ownedPaperOrNull(userId: UserId, docId: PaperId) {
  const rows = await getDb()
    .select()
    .from(paperDocs)
    .where(and(eq(paperDocs.id, docId), eq(paperDocs.userId, userId)))
    .limit(1)
  return rows[0] ?? null
}

export async function ownedPaper(
  userId: UserId,
  docId: PaperId,
  writer?: NativeWriter
) {
  const row = (await ownedPaperOrNull(userId, docId)) ?? documentNotFound()
  admitDocument(readStoredPaper(row), writer)
  return row
}

function v3Of(kind: PaperStoredKind, value: unknown): PaperDocument | null {
  const parsed = legacyPaperDocumentSchema.safeParse(value)
  if (!parsed.success || parsed.data.kind !== kind) return null
  return parsed.data
}

function blankPaper(kind: PaperStoredKind): PaperDocument {
  return kind === "cv" ? blankCv() : blankLetter()
}

function sharedPhotoRef(document: unknown): string | null {
  const parsed = paperDocumentSchema.safeParse(document)
  if (!parsed.success || parsed.data.kind !== "cv") return null
  return parsed.data.header?.photo ?? null
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
    .flatMap((row) => {
      if (isRichPaper(row)) return listedForEditor(row, writer)
      const paper = tryReadStoredPaper(row)
      return paper ? [toPaper(row, paper, writer)] : []
    })
  const seen = new Set(stored.map((item) => item.id))
  const minted = (await listPackagePapers(userId)).filter(
    (item) =>
      !seen.has(item.id) &&
      (!kind || item.kind === kind) &&
      (!needle || item.name.toLowerCase().includes(needle))
  )
  return [...stored, ...minted].sort((left, right) =>
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
    document?: unknown
    paper?: unknown
  },
  writer?: NativeWriter
) {
  const now = new Date()
  const id = createId(now.getTime())
  const stored = input.paper
    ? storedPaperDocumentSchema.parse(input.paper)
    : null
  if (stored && stored.kind !== input.kind)
    throw new CommandError(
      ERROR_CODES.CONFLICT,
      "The document kind does not match."
    )
  const paper =
    stored ?? v3Of(input.kind, input.document) ?? blankPaper(input.kind)
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
      createdAt: now,
      updatedAt: now,
    })
  importParsers.onInsert?.()
  const row = (await ownedPaperOrNull(actor.userId, parsePaperId(id))) ?? null
  if (!row) return documentNotFound()
  return paper.version === 4 && paper.schemaRevision === 2
    ? readPaperDocumentInfo(actor.userId, parsePaperId(id), writer)
    : toPaper(row, undefined, writer)
}

export async function renamePaper(
  actor: Actor,
  docId: PaperId,
  name: string,
  writer?: NativeWriter
) {
  const current = await ownedPaperOrNull(actor.userId, docId)
  if (!current)
    return (
      (await renameWordPage(actor.userId, docId, name)) ?? documentNotFound()
    )
  toListedPaper(current, writer)
  const updatedAt = new Date()
  await getDb()
    .update(paperDocs)
    .set({ name, updatedAt })
    .where(eq(paperDocs.id, current.id))
  return {
    ...toListedPaper({ ...current, name, updatedAt }, writer),
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

export type DuplicatePlan =
  { kind: "block" } | { kind: "word"; copy: WordPageCopy } | { kind: "missing" }

export async function planDuplicate(
  actor: Actor,
  docId: PaperId
): Promise<DuplicatePlan> {
  if (await ownedPaperOrNull(actor.userId, docId)) return { kind: "block" }
  const copy = await stageWordPageCopy(actor.userId, docId)
  return copy ? { kind: "word", copy } : { kind: "missing" }
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
  if (plan.kind === "word")
    return (
      (await publishWordPageCopy(actor.userId, plan.copy)) ?? documentNotFound()
    )
  const source =
    (await ownedPaperOrNull(actor.userId, docId)) ?? documentNotFound()
  if (isRichPaper(source)) return copyOfRichPaper(actor, source, writer)
  const current = await ownedPaper(actor.userId, docId, writer)
  return createPaper(
    actor,
    {
      kind: current.kind,
      name: `Copy of ${current.name}`.slice(0, 200),
      templateId: current.templateId ?? undefined,
      paper: readStoredPaper(current),
    },
    writer
  )
}

export async function deletePaper(actor: Actor, docId: PaperId) {
  if (!(await ownedPaperOrNull(actor.userId, docId)))
    return (await deleteWordPage(actor.userId, docId)) ?? documentNotFound()
  await getDb().delete(paperDocs).where(eq(paperDocs.id, docId))
  return { id: docId }
}

export async function restoreDeletedPaper(actor: Actor, docId: PaperId) {
  return (await restoreWordPage(actor.userId, docId)) ?? documentNotFound()
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
  status: "draft" | "ready" | "published",
  writer?: NativeWriter
) {
  const current =
    (await ownedPaperOrNull(actor.userId, docId)) ?? documentNotFound()
  toListedPaper(current, writer)
  const updatedAt = new Date()
  await getDb()
    .update(paperDocs)
    .set({ status, updatedAt })
    .where(eq(paperDocs.id, docId))
  return toListedPaper({ ...current, status, updatedAt }, writer)
}

export async function sharePaper(
  actor: Actor,
  docId: PaperId,
  writer?: NativeWriter
) {
  await ownedPaper(actor.userId, docId, writer)
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

export async function unsharePaper(
  actor: Actor,
  docId: PaperId,
  writer?: NativeWriter
) {
  await ownedPaper(actor.userId, docId, writer)
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

export const COACH_TWO_PAGES_PAST_STORED_JSON_CHARS = 3500

export function coachPagesFromStoredJson(storedJsonChars: number): 1 | 2 {
  return storedJsonChars > COACH_TWO_PAGES_PAST_STORED_JSON_CHARS ? 2 : 1
}

export async function pageCount(
  actor: Actor,
  docId: PaperId,
  writer?: NativeWriter
) {
  const doc = await ownedPaper(actor.userId, docId, writer)
  return {
    docId,
    pages: coachPagesFromStoredJson(JSON.stringify(doc.crdtDocument).length),
    pageChoice: doc.pageChoice,
  }
}

function withPhotoRef(
  document: PaperDocument,
  ref: string | null
): PaperDocument {
  if (document.kind !== "cv") {
    throw new CommandError(
      ERROR_CODES.VALIDATION_ERROR,
      "A photo belongs on a CV."
    )
  }
  if (!ref) {
    if (!document.header) return document
    const { photo: _removed, ...header } = document.header
    void _removed
    return { ...document, header }
  }
  return {
    ...document,
    header: {
      ...(document.header ?? paperNodeSpecs.header.blank()),
      photo: ref,
    },
  }
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

export async function readSharedPhoto(token: string) {
  const rows = await getDb()
    .select({ doc: paperDocs })
    .from(paperShares)
    .innerJoin(paperDocs, eq(paperDocs.id, paperShares.docId))
    .where(eq(paperShares.token, token))
    .limit(1)
  const row = rows[0]
  if (!row) throw new CommandError(ERROR_CODES.NOT_FOUND, "Photo not found")
  const fileId = paperPhotoFileId(sharedPhotoRef(row.doc.crdtDocument))
  if (!fileId) throw new CommandError(ERROR_CODES.NOT_FOUND, "Photo not found")
  return readOwnedPhoto(parseUserId(row.doc.userId), parseFileId(fileId))
}

export async function attachPhoto(
  actor: Actor,
  docId: PaperId,
  fileId: FileId | null
) {
  await ownedPaper(actor.userId, docId)
  if (fileId) await requireAvatarFile(actor.userId, fileId)
  return withContent(actor.userId, docId, async (content) => {
    const written = await content.edit({
      origin: "server",
      target: (current) =>
        withPhotoRef(current, fileId ? paperPhotoRef(fileId) : null),
    })
    return {
      ...toPaper(written),
      previousPaper: content.document,
    }
  })
}

export async function readShared(token: string, writer?: NativeWriter) {
  const rows = await getDb()
    .select({ doc: paperDocs })
    .from(paperShares)
    .innerJoin(paperDocs, eq(paperDocs.id, paperShares.docId))
    .where(eq(paperShares.token, token))
    .limit(1)
  const row = rows[0]
  if (!row)
    throw new CommandError(ERROR_CODES.NOT_FOUND, "Share link not found")
  return toSharedPaper(row.doc, writer)
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
