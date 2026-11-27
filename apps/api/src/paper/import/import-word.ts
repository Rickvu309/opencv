import { ERROR_CODES } from "@workspace/domain/kernel"

import { CommandError } from "../../platform/errors.js"
import {
  classifyImport,
  IMPORT_FAILED_MESSAGE,
  type ImportReader,
  importReadStop,
  parseImportFile,
} from "./import-parse.js"
import { importedTextLines } from "./import-text-lines.js"
import {
  paperFromLines,
  paperFromWord,
  PHOTOS_DROPPED,
  TABLES_FLATTENED,
} from "./word-to-paper.js"

export const PDF_IMPORT_NOTICE =
  "Imported the text of your PDF. Layout, fonts and photo were not kept."

const DROPPED_NOTICE: Record<string, string> = {
  [PHOTOS_DROPPED]: "photos were left out",
  [TABLES_FLATTENED]: "tables with merged cells became plain paragraphs",
  formatting: "its formatting was left out",
}

export function droppedNotice(dropped: readonly string[]) {
  const parts = dropped.map((part) => DROPPED_NOTICE[part] ?? part)
  return parts.length
    ? `Imported your Word file, but ${parts.join(" and ")}.`
    : null
}

export type ImportedPaper = {
  readonly name: string
  readonly paper: Awaited<ReturnType<typeof paperFromWord>>["paper"]
  readonly notice: string | null
}

export function importedPageName(fileName: string) {
  return (fileName.replace(/\.[^.]+$/u, "").trim() || "CV").slice(0, 200)
}

async function parsed(
  input: {
    name: string
    mediaType: string
    bytes: Buffer
  },
  reader: ImportReader
) {
  try {
    return await parseImportFile(input, reader)
  } catch (error) {
    if (importReadStop(error, "import")) throw error
    throw new CommandError(ERROR_CODES.VALIDATION_ERROR, IMPORT_FAILED_MESSAGE)
  }
}

export async function importedLines(
  input: { name: string; mediaType: string; bytes: Buffer },
  reader: ImportReader
) {
  const read = await parsed(input, reader)
  if (!read.ok) throw new CommandError(ERROR_CODES[read.code], read.message)
  const lines = importedTextLines(read.text)
  if (!lines.ok)
    throw new CommandError(ERROR_CODES.FILE_UNSUPPORTED, lines.message)
  return {
    lines: lines.lines,
    notice: read.kind === "pdf" ? PDF_IMPORT_NOTICE : null,
  }
}

export async function importedPaper(
  input: {
    name: string
    mediaType: string
    bytes: Buffer
    kind?: "cv" | "letter"
  },
  reader: ImportReader
): Promise<ImportedPaper> {
  const kind = input.kind ?? "cv"
  const name = importedPageName(input.name)
  if (
    input.name.toLowerCase().endsWith(".docx") ||
    classifyImport(input) === "docx"
  ) {
    const word = await paperFromWord(input.bytes, kind).catch(() => {
      throw new CommandError(
        ERROR_CODES.VALIDATION_ERROR,
        IMPORT_FAILED_MESSAGE
      )
    })
    return { name, paper: word.paper, notice: droppedNotice(word.dropped) }
  }
  const read = await parsed(input, reader)
  if (!read.ok) throw new CommandError(ERROR_CODES[read.code], read.message)
  const lines = importedTextLines(read.text)
  if (!lines.ok)
    throw new CommandError(ERROR_CODES.FILE_UNSUPPORTED, lines.message)
  return {
    name,
    paper: paperFromLines(kind, lines.lines),
    notice: read.kind === "pdf" ? PDF_IMPORT_NOTICE : null,
  }
}
