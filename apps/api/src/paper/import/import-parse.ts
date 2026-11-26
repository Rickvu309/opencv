import {
  IMPORT_GOOGLE_MESSAGE,
  IMPORT_LINKEDIN_MESSAGE,
  IMPORT_PAGES_MESSAGE,
  LETTER_ATTACHMENT_TEXT_MAX,
  type LetterAttachmentContext,
} from "@workspace/domain/paper-doc"

import { IMPORT_TEXT_LIMITS } from "./import-limits.js"
import { ImportReadCancelled, ImportReadLimited } from "./import-read-queue.js"
import {
  ImportReadOff,
  type ImportReadReason,
  ImportReadRefusal,
  readImportText,
} from "./import-text-pool.js"

export const IMPORT_GENERIC_MESSAGE = "Upload a PDF, Word, or text file."
export const IMPORT_FAILED_MESSAGE = "Could not import that file. Try it again."
export const IMPORT_EMPTY_MESSAGE =
  "This file is empty. Choose the file with your CV in it."
export const IMPORT_JSON_MESSAGE =
  "A JSON file cannot be imported as a CV. Import a PDF, Word or text file."
export const IMPORT_SCANNED_MESSAGE =
  "This PDF has no text we can read. It may be a scan or a photo. Export it again from the app you wrote it in, or import a Word or text file."
export const IMPORT_LOCKED_MESSAGE =
  "This PDF is protected with a password. Save a copy without the password, then import it again."
export const IMPORT_PDF_PAGES_MESSAGE =
  "This PDF has more than 20 pages. Import a shorter CV."
export const IMPORT_PDF_HEAVY_MESSAGE =
  "This PDF is too large or complex to read as a CV. Export it again from the app you wrote it in, or import a Word or text file."
export const IMPORT_PDF_UNREADABLE_MESSAGE =
  "We could not read this PDF. Export it again from the app you wrote it in, or import a Word or text file."
export const IMPORT_TEXT_LONG_MESSAGE =
  "This file has more than 200,000 characters of text. Import a shorter CV."
export const IMPORT_BUSY_MESSAGE =
  "Many files are being read right now. Try again in a minute."
export const IMPORT_ACCOUNT_BUSY_MESSAGE =
  "Your last file is still being read. Import this one when it finishes."
export const IMPORT_CANCELLED_MESSAGE =
  "The import was cancelled. No document was made."
export const IMPORT_READER_OFF_MESSAGE =
  "Reading PDF files is switched off on this server for now. Import a Word or text file instead."
export const LETTER_READER_OFF_MESSAGE =
  "Reading PDF and Word files is switched off on this server for now. Paste the job text or choose a text file."

export function importBudgetMessage(retryAfterSeconds: number) {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60))
  return `Your recent files took a long time to read, so reading files is paused for your account. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`
}

export type ImportReader = { owner: string; signal?: AbortSignal }

export type ImportReadStop = {
  status: 400 | 429 | 503
  code: string
  message: string
  retryAfterSeconds: number | null
}

export function importReadStop(
  error: unknown,
  place: "import" | "letter"
): ImportReadStop | null {
  if (error instanceof ImportReadCancelled)
    return {
      status: 400,
      code: "VALIDATION_ERROR",
      message: IMPORT_CANCELLED_MESSAGE,
      retryAfterSeconds: null,
    }
  if (error instanceof ImportReadOff)
    return {
      status: 503,
      code: "IMPORT_READER_OFF",
      message:
        place === "import"
          ? IMPORT_READER_OFF_MESSAGE
          : LETTER_READER_OFF_MESSAGE,
      retryAfterSeconds: null,
    }
  if (!(error instanceof ImportReadLimited)) return null
  if (error.limit === "service-busy")
    return {
      status: 503,
      code: "IMPORT_READ_BUSY",
      message: IMPORT_BUSY_MESSAGE,
      retryAfterSeconds: error.retryAfterSeconds,
    }
  return {
    status: 429,
    code: "IMPORT_READ_LIMITED",
    message:
      error.limit === "account-busy"
        ? IMPORT_ACCOUNT_BUSY_MESSAGE
        : importBudgetMessage(error.retryAfterSeconds),
    retryAfterSeconds: error.retryAfterSeconds,
  }
}

const WORD =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

export type ImportParseResult =
  | { ok: true; kind: "pdf" | "text"; text: string }
  | {
      ok: false
      code: "FILE_UNSUPPORTED" | "LINK_UNREADABLE"
      message: string
    }

function hostIs(host: string, domain: string) {
  return host === domain || host.endsWith(`.${domain}`)
}

function linkHost(value: string) {
  const match = /^https?:\/\/([^/?#]+)/i.exec(value.trim())
  const host = match?.[1]?.replace(/:\d+$/, "").toLowerCase()
  return host || null
}

export function unreadableImportLink(value: string): string | null {
  const host = linkHost(value)
  if (!host) return null
  if (hostIs(host, "docs.google.com")) return IMPORT_GOOGLE_MESSAGE
  if (hostIs(host, "linkedin.com")) return IMPORT_LINKEDIN_MESSAGE
  return null
}

function isPages(name: string, mediaType: string) {
  return (
    name.toLowerCase().endsWith(".pages") ||
    mediaType === "application/vnd.apple.pages"
  )
}

function refused(
  code: "FILE_UNSUPPORTED" | "LINK_UNREADABLE",
  message: string
): ImportParseResult {
  return { ok: false, code, message }
}

class ImportRefusal extends Error {}

const READ_REFUSALS: Partial<Record<ImportReadReason, string>> = {
  pages: IMPORT_PDF_PAGES_MESSAGE,
  locked: IMPORT_LOCKED_MESSAGE,
  heavy: IMPORT_PDF_HEAVY_MESSAGE,
  slow: IMPORT_PDF_HEAVY_MESSAGE,
  text: IMPORT_TEXT_LONG_MESSAGE,
  failed: IMPORT_PDF_UNREADABLE_MESSAGE,
}

async function defaultPdfText(
  bytes: Buffer,
  whole: boolean,
  reader: ImportReader
) {
  try {
    return await readImportText({
      kind: "pdf",
      bytes,
      whole,
      deadlineMs: importParsers.timeoutMs,
      owner: reader.owner,
      ...(reader.signal ? { signal: reader.signal } : {}),
    })
  } catch (error) {
    const message =
      error instanceof ImportReadRefusal ? READ_REFUSALS[error.reason] : null
    if (whole && message) throw new ImportRefusal(message)
    throw error
  }
}

const ZIP_ENTRY_CAP = 128
const ZIP_DECLARED_CAP = 32_000_000
const ZIP_DATA_DESCRIPTOR_FLAG = 0x08

function entryHidesSizeUntilDataDescriptor(flags: number, compressed: number) {
  return (flags & ZIP_DATA_DESCRIPTOR_FLAG) !== 0 && compressed === 0
}

function zipAllowsMammoth(bytes: Buffer) {
  let offset = 0
  let count = 0
  let declared = 0
  while (offset + 30 <= bytes.length && count <= ZIP_ENTRY_CAP) {
    const signature = bytes.readUInt32LE(offset)
    if (signature === 0x02014b50 || signature === 0x06054b50) {
      return declared <= ZIP_DECLARED_CAP
    }
    if (signature !== 0x04034b50) return false
    const flags = bytes.readUInt16LE(offset + 6)
    const compressed = bytes.readUInt32LE(offset + 18)
    const uncompressed = bytes.readUInt32LE(offset + 22)
    const nameLength = bytes.readUInt16LE(offset + 26)
    const extraLength = bytes.readUInt16LE(offset + 28)
    if (uncompressed > ZIP_DECLARED_CAP) return false
    declared += uncompressed
    if (declared > ZIP_DECLARED_CAP) return false
    count += 1
    if (count > ZIP_ENTRY_CAP) return false
    if (entryHidesSizeUntilDataDescriptor(flags, compressed)) return true
    const next = offset + 30 + nameLength + extraLength + compressed
    if (next <= offset || next > bytes.length) return false
    offset = next
  }
  return false
}

async function defaultDocxText(bytes: Buffer, reader: ImportReader) {
  if (!zipAllowsMammoth(bytes)) {
    throw new Error("import-zip-entries")
  }
  return readImportText({
    kind: "docx",
    bytes,
    whole: false,
    deadlineMs: importParsers.timeoutMs,
    owner: reader.owner,
    ...(reader.signal ? { signal: reader.signal } : {}),
  })
}

function isPdfBytes(bytes: Buffer) {
  return (
    bytes.length >= 5 && bytes.subarray(0, 5).toString("latin1") === "%PDF-"
  )
}

function isZipBytes(bytes: Buffer) {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  )
}

function isMarkup(bytes: Buffer) {
  let index = 0
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    index = 3
  }
  const end = Math.min(bytes.length, index + 48)
  while (index < end) {
    const byte = bytes[index]
    if (byte !== 9 && byte !== 10 && byte !== 13 && byte !== 32) break
    index += 1
  }
  const head = bytes
    .subarray(index, Math.min(bytes.length, index + 12))
    .toString("latin1")
    .toLowerCase()
  return (
    head.startsWith("<?xml") ||
    head.startsWith("<svg") ||
    head.startsWith("<!doctype") ||
    head.startsWith("<html")
  )
}

function isTextLike(bytes: Buffer) {
  if (bytes.length === 0) return false
  const sample = bytes.subarray(0, Math.min(bytes.length, 4096))
  let weird = 0
  for (const byte of sample) {
    if (byte === 0) return false
    const printable =
      byte === 9 ||
      byte === 10 ||
      byte === 13 ||
      (byte >= 32 && byte < 127) ||
      byte >= 128
    if (!printable) weird += 1
  }
  return weird / sample.length < 0.1
}

export type ImportKind = "pdf" | "docx" | "text" | "json" | "pages" | "unknown"

export function classifyImport(input: {
  name: string
  mediaType: string
  bytes: Buffer
}): ImportKind {
  const name = input.name.toLowerCase()
  if (isPages(name, input.mediaType)) return "pages"
  if (isPdfBytes(input.bytes)) return "pdf"
  if (isZipBytes(input.bytes)) return "docx"
  if (isMarkup(input.bytes)) return "unknown"
  if (input.mediaType === "application/json" || name.endsWith(".json")) {
    return "json"
  }
  if (!isTextLike(input.bytes)) return "unknown"
  return "text"
}

export function mediaTypeForImport(kind: ImportKind) {
  if (kind === "pdf") return "application/pdf"
  if (kind === "docx") return WORD
  if (kind === "json") return "application/json"
  if (kind === "text") return "text/plain"
  return "application/octet-stream"
}

export const importParsers = {
  timeoutMs: 10_000,
  pdfText: defaultPdfText,
  docxText: defaultDocxText,
  onInsert: null as (() => void) | null,
}

export function parseImportLink(value: string): ImportParseResult | null {
  const message = unreadableImportLink(value)
  if (!message) return null
  return refused("LINK_UNREADABLE", message)
}

type ImportFileInput = { name: string; mediaType: string; bytes: Buffer }

async function extractedText(input: ImportFileInput, reader: ImportReader) {
  const kind = classifyImport(input)
  if (kind === "pdf") return importParsers.pdfText(input.bytes, false, reader)
  if (kind === "docx") return importParsers.docxText(input.bytes, reader)
  return input.bytes.toString("utf8")
}

export async function extractLetterAttachment(
  input: ImportFileInput,
  reader: ImportReader
): Promise<
  | { ok: true; context: LetterAttachmentContext }
  | { ok: false; code: "FILE_UNSUPPORTED"; message: string }
> {
  const kind = classifyImport(input)
  if (kind === "pages" || kind === "unknown" || kind === "json") {
    return {
      ok: false,
      code: "FILE_UNSUPPORTED",
      message: IMPORT_GENERIC_MESSAGE,
    }
  }
  const raw = (await extractedText(input, reader)).trim()
  if (!raw) {
    return {
      ok: false,
      code: "FILE_UNSUPPORTED",
      message:
        "No readable text found. Paste the job text or choose another file.",
    }
  }
  return {
    ok: true,
    context: {
      name: input.name.slice(0, 200) || "Attachment",
      text: raw.slice(0, LETTER_ATTACHMENT_TEXT_MAX),
      truncated: raw.length > LETTER_ATTACHMENT_TEXT_MAX,
    },
  }
}

async function importText(
  input: ImportFileInput,
  kind: "pdf" | "text",
  reader: ImportReader
) {
  if (kind === "text") {
    if (input.bytes.length > IMPORT_TEXT_LIMITS.textFileBytes)
      return new ImportRefusal(IMPORT_TEXT_LONG_MESSAGE)
    return input.bytes.toString("utf8")
  }
  try {
    return await importParsers.pdfText(input.bytes, true, reader)
  } catch (error) {
    if (error instanceof ImportRefusal) return error
    throw error
  }
}

export async function parseImportFile(
  input: ImportFileInput,
  reader: ImportReader
): Promise<ImportParseResult> {
  if (input.bytes.length === 0)
    return refused("FILE_UNSUPPORTED", IMPORT_EMPTY_MESSAGE)
  const kind = classifyImport(input)
  if (kind === "pages") return refused("FILE_UNSUPPORTED", IMPORT_PAGES_MESSAGE)
  if (kind === "json") return refused("FILE_UNSUPPORTED", IMPORT_JSON_MESSAGE)
  if (kind !== "pdf" && kind !== "text")
    return refused("FILE_UNSUPPORTED", IMPORT_GENERIC_MESSAGE)
  const text = await importText(input, kind, reader)
  if (text instanceof ImportRefusal)
    return refused("FILE_UNSUPPORTED", text.message)
  if (text.replace(/^\uFEFF/u, "").trim() === "")
    return refused(
      "FILE_UNSUPPORTED",
      kind === "pdf" ? IMPORT_SCANNED_MESSAGE : IMPORT_EMPTY_MESSAGE
    )
  return { ok: true, kind, text: text.replace(/^\uFEFF/u, "") }
}
