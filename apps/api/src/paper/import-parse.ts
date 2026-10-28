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

async function pdfText(bytes: Buffer) {
  const unpdf = await import("unpdf")
  const pdf = await unpdf.getDocumentProxy(new Uint8Array(bytes))
  const extracted = await unpdf.extractText(pdf, { mergePages: true })
  const text = extracted.text
  return Array.isArray(text) ? text.join("\n") : String(text ?? "")
}

type MammothApi = {
  extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string }>
}

/** mammoth is `export =`, so a dynamic import may nest the API under default. */
async function docxText(bytes: Buffer) {
  const loaded = (await import("mammoth")) as MammothApi & {
    default?: MammothApi
  }
  const mammoth = loaded.default ?? loaded
  const extracted = await mammoth.extractRawText({ buffer: bytes })
  return extracted.value
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
  const name = input.name.toLowerCase()
  if (isPages(name, input.mediaType)) {
    return refused("FILE_UNSUPPORTED", IMPORT_PAGES_MESSAGE)
  }
  if (input.mediaType === "application/pdf" || name.endsWith(".pdf")) {
    return textBlocks(await pdfText(input.bytes))
  }
  if (input.mediaType === WORD || name.endsWith(".docx")) {
    return textBlocks(await docxText(input.bytes))
  }
  const raw = input.bytes.toString("utf8")
  if (input.mediaType === "application/json" || name.endsWith(".json")) {
    return jsonDocument(raw)
  }
  if (input.mediaType === "text/plain" || name.endsWith(".txt")) {
    return textBlocks(raw)
  }
  return refused("FILE_UNSUPPORTED", IMPORT_GENERIC_MESSAGE)
}
