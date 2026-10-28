import {
  IMPORT_PAGES_MESSAGE,
  findImportChecks,
  isCvDocument,
  isCvBlockDocument,
  paragraphsToBlockDocument,
  readCvBlocks,
  unreadableImportLink,
  type CvImportCheck,
} from "@workspace/domain"

export const IMPORT_GENERIC_MESSAGE = "Upload a PDF, Word, or text file."
export const IMPORT_FAILED_MESSAGE = "Could not import that file. Try it again."

const WORD =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

export type ImportParseResult =
  | { ok: true; document: unknown; checks: CvImportCheck[] }
  | {
      ok: false
      code: "FILE_UNSUPPORTED" | "LINK_UNREADABLE"
      message: string
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

function textBlocks(raw: string): ImportParseResult {
  const document = paragraphsToBlockDocument(raw)
  return { ok: true, document, checks: findImportChecks(document) }
}

/** A JSON CV is stored as parsed. Anything else in the file becomes text blocks. */
function jsonDocument(raw: string): ImportParseResult {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (isCvBlockDocument(parsed) || isCvDocument(parsed)) {
      const blocks = readCvBlocks(parsed)
      return {
        ok: true,
        document: parsed,
        checks: blocks ? findImportChecks(blocks) : [],
      }
    }
  } catch {
    return textBlocks(raw)
  }
  return textBlocks(raw)
}

const PDF_PAGE_CAP = 20

type PdfTextItem = { str?: string }
type PdfPage = { getTextContent: () => Promise<{ items: PdfTextItem[] }> }
type PdfDocument = {
  numPages: number
  getPage: (page: number) => Promise<PdfPage>
  destroy?: () => Promise<void> | void
}

async function openPdfDocument(bytes: Buffer): Promise<PdfDocument> {
  const unpdf = await import("unpdf")
  return (await unpdf.getDocumentProxy(new Uint8Array(bytes))) as PdfDocument
}

async function readPdfPages(pdf: PdfDocument) {
  const count = Math.min(pdf.numPages, PDF_PAGE_CAP)
  const pages: string[] = []
  for (let page = 1; page <= count; page += 1) {
    const content = await (await pdf.getPage(page)).getTextContent()
    pages.push(content.items.map((item) => item.str ?? "").join(""))
  }
  return pages.join("\n")
}

async function defaultPdfText(bytes: Buffer) {
  const pdf = await importParsers.openPdf(bytes)
  // The deadline must own this function so destroy runs before the 400.
  bytes = Buffer.alloc(0)
  void bytes
  const pending = readPdfPages(pdf)
  void pending.catch(() => undefined)
  try {
    return await withDeadline(pending)
  } finally {
    await pdf.destroy?.()
  }
}

type MammothApi = {
  extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string }>
}

const DOCX_TEXT_CAP = 200_000
const ZIP_ENTRY_CAP = 128
const ZIP_DECLARED_CAP = 32_000_000

/** Local headers must fit before mammoth. A data-descriptor entry counts as one. */
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
    if ((flags & 0x08) !== 0 && compressed === 0) return true
    const next = offset + 30 + nameLength + extraLength + compressed
    if (next <= offset || next > bytes.length) return false
    offset = next
  }
  return false
}

/** mammoth is `export =`, so a dynamic import may nest the API under default. */
async function defaultDocxText(bytes: Buffer) {
  if (!zipAllowsMammoth(bytes)) {
    throw new Error("import-zip-entries")
  }
  const loaded = (await import("mammoth")) as MammothApi & {
    default?: MammothApi
  }
  const mammoth = loaded.default ?? loaded
  const extracted = await mammoth.extractRawText({ buffer: bytes })
  return extracted.value.slice(0, DOCX_TEXT_CAP)
}

function withDeadline<T>(work: Promise<T>) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error("import-parse-timeout")),
      importParsers.timeoutMs
    )
  })
  return Promise.race([work, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
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

/**
 * Tests replace a reader or the deadline. Production leaves the defaults.
 * The deadline is read when the parse starts.
 */
export const importParsers = {
  timeoutMs: 10_000,
  openPdf: openPdfDocument,
  pdfText: defaultPdfText,
  docxText: defaultDocxText,
  /** Tests abort while the CV row is inserted. Production stays null. */
  onInsert: null as (() => void) | null,
}

export function parseImportLink(value: string): ImportParseResult | null {
  const message = unreadableImportLink(value)
  if (!message) return null
  return refused("LINK_UNREADABLE", message)
}

export async function parseImportFile(input: {
  name: string
  mediaType: string
  bytes: Buffer
}): Promise<ImportParseResult> {
  const kind = classifyImport(input)
  if (kind === "pages") {
    return refused("FILE_UNSUPPORTED", IMPORT_PAGES_MESSAGE)
  }
  if (kind === "unknown") {
    return refused("FILE_UNSUPPORTED", IMPORT_GENERIC_MESSAGE)
  }
  if (kind === "pdf") {
    return textBlocks(await importParsers.pdfText(input.bytes))
  }
  if (kind === "docx") {
    return textBlocks(await withDeadline(importParsers.docxText(input.bytes)))
  }
  const raw = input.bytes.toString("utf8")
  if (kind === "json") return jsonDocument(raw)
  return textBlocks(raw)
}
