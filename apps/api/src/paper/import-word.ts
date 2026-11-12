import { ERROR_CODES } from "@workspace/domain"

import { CommandError } from "../registry/errors.js"
import { IMPORT_FAILED_MESSAGE, parseImportFile } from "./import-parse.js"
import { importedTextLines } from "./word/from-text.js"
import { pageBytesOf } from "./word/template.js"

export const PDF_IMPORT_NOTICE =
  "Imported the text of your PDF. Layout, fonts and photo were not kept."

export type ImportedWordPage = {
  readonly name: string
  readonly bytes: Uint8Array
  readonly notice: string | null
}

export function importedPageName(fileName: string) {
  return (fileName.replace(/\.[^.]+$/u, "").trim() || "CV").slice(0, 200)
}

async function parsed(input: {
  name: string
  mediaType: string
  bytes: Buffer
}) {
  try {
    return await parseImportFile(input)
  } catch {
    throw new CommandError(ERROR_CODES.VALIDATION_ERROR, IMPORT_FAILED_MESSAGE)
  }
}

export async function importedWordPage(input: {
  name: string
  mediaType: string
  bytes: Buffer
}): Promise<ImportedWordPage> {
  const read = await parsed(input)
  if (!read.ok) throw new CommandError(ERROR_CODES[read.code], read.message)
  const lines = importedTextLines(read.text)
  if (!lines.ok)
    throw new CommandError(ERROR_CODES.FILE_UNSUPPORTED, lines.message)
  return {
    name: importedPageName(input.name),
    bytes: pageBytesOf(lines.lines),
    notice: read.kind === "pdf" ? PDF_IMPORT_NOTICE : null,
  }
}
