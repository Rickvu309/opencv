import {
  ERROR_CODES,
  parseFileId,
  type FileId,
  type UserId,
} from "@workspace/domain/kernel"
import {
  paperEngineBlank,
  type Block,
  type Document,
} from "@workspace/domain/paper-doc"

import { transaction } from "../db/context.js"
import { CommandError } from "../platform/errors.js"
import { createId } from "../platform/id.js"
import { admitted, engineLog } from "./engine-sync-log.js"
import { blocksFromLines } from "./engine-import-lines.js"
import {
  classifyImport,
  IMPORT_FAILED_MESSAGE,
  IMPORT_GENERIC_MESSAGE,
} from "./import/import-parse.js"
import { importedLines } from "./import/import-word.js"
import {
  AVATAR_CAP,
  createEngineImportPage,
  readImportFile,
  saveFile,
} from "./store.js"
import { readDocx } from "./word/read-docx.js"

type ReadLines = Awaited<ReturnType<typeof importedLines>>

const linesReadByRoute = new Map<FileId, ReadLines>()

export function handImportedLines(fileId: FileId, read: ReadLines) {
  linesReadByRoute.set(fileId, read)
}

type EngineImportInput = {
  fileId: FileId
  name: string
  kind: "cv" | "letter"
}

export async function importEnginePaper(
  owner: UserId,
  input: EngineImportInput
) {
  const source = await readImportFile(owner, input.fileId)
  const bytes = Buffer.from(source.bytes)
  const kind = classifyImport({
    name: input.name,
    mediaType: source.mediaType,
    bytes,
  })
  if (kind === "docx") return importEngineWord(owner, input, bytes)
  const handed = linesReadByRoute.get(input.fileId)
  linesReadByRoute.delete(input.fileId)
  if (!handed && kind !== "pdf" && kind !== "text")
    throw new CommandError(ERROR_CODES.FILE_UNSUPPORTED, IMPORT_GENERIC_MESSAGE)
  const read =
    handed ??
    (await importedLines(
      { name: input.name, mediaType: source.mediaType, bytes },
      { owner }
    ))
  return writeImportedPage(owner, input, {
    content: blocksFromLines(read.lines),
    page: null,
    dropped: read.notice ? [read.notice] : [],
    client: "text-import",
  })
}

function importEngineWord(
  owner: UserId,
  input: EngineImportInput,
  bytes: Buffer
) {
  return transaction(async () => {
    const parsed = await readDocx(bytes).catch(() => {
      throw new CommandError(
        ERROR_CODES.VALIDATION_ERROR,
        IMPORT_FAILED_MESSAGE
      )
    })
    const dropped = new Set(parsed.dropped)
    const content: Block[] = []
    const imageIds = new Map<FileId, FileId>()
    for (const block of parsed.document.content) {
      if (block.type !== "image") {
        content.push(block)
        continue
      }
      const image = parsed.files.get(block.attrs.fileId)
      if (
        !image ||
        image.bytes.byteLength > AVATAR_CAP ||
        (image.mediaType !== "image/jpeg" && image.mediaType !== "image/png")
      ) {
        dropped.add("Some images were left out.")
        continue
      }
      let fileId = imageIds.get(block.attrs.fileId)
      if (!fileId) {
        const saved = await saveFile({
          userId: owner,
          name: block.attrs.alt || "Photo",
          mediaType: image.mediaType,
          bytes: Buffer.from(image.bytes),
          purpose: "avatar",
        })
        fileId = parseFileId(saved.id)
        imageIds.set(block.attrs.fileId, fileId)
      }
      content.push({ ...block, attrs: { ...block.attrs, fileId } })
    }
    return writeImportedPage(owner, input, {
      content,
      page: parsed.document.attrs.page,
      dropped: [...dropped],
      client: "word-import",
    })
  })
}

function writeImportedPage(
  owner: UserId,
  input: EngineImportInput,
  imported: {
    content: Block[]
    page: Document["attrs"]["page"] | null
    dropped: string[]
    client: "word-import" | "text-import"
  }
) {
  return transaction(async () => {
    const blank = paperEngineBlank.emptyPaper(input.kind)
    const { content } = imported
    const docId = await createEngineImportPage(owner, input)
    admitted(
      await engineLog.start(docId, {
        ...blank,
        attrs: { ...blank.attrs, page: imported.page ?? blank.attrs.page },
      })
    )
    admitted(
      await engineLog.append(docId, {
        edit: createId(),
        origin: { kind: "import", actor: owner, client: imported.client },
        base: 0,
        steps: [
          {
            stepType: "replace",
            from: 0,
            to: 2,
            slice: { content: content.length ? content : blank.content },
          },
        ],
        inverse: [],
        commands: [],
      })
    )
    return {
      docId,
      name: input.name,
      kind: input.kind,
      dropped: imported.dropped,
    }
  })
}
