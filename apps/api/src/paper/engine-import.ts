import {
  ERROR_CODES,
  parseFileId,
  type FileId,
  type UserId,
} from "@workspace/domain/kernel"
import { paperEngineBlank, type Block } from "@workspace/domain/paper-doc"

import { transaction } from "../db/context.js"
import { CommandError } from "../platform/errors.js"
import { createId } from "../platform/id.js"
import { admitted, engineLog } from "./engine-sync-log.js"
import {
  IMPORT_FAILED_MESSAGE,
  mediaTypeForImport,
} from "./import/import-parse.js"
import {
  AVATAR_CAP,
  createEngineImportPage,
  readImportFile,
  saveFile,
} from "./store.js"
import { readDocx } from "./word/read-docx.js"

export function importEnginePaper(
  owner: UserId,
  input: { fileId: FileId; name: string; kind: "cv" | "letter" }
) {
  return transaction(async () => {
    const source = await readImportFile(owner, input.fileId)
    if (source.mediaType !== mediaTypeForImport("docx"))
      throw new CommandError(
        ERROR_CODES.FILE_UNSUPPORTED,
        "Choose a Word (.docx) file."
      )

    const parsed = await readDocx(source.bytes).catch(() => {
      throw new CommandError(
        ERROR_CODES.VALIDATION_ERROR,
        IMPORT_FAILED_MESSAGE
      )
    })
    const dropped = new Set(parsed.dropped)
    const blank = paperEngineBlank.emptyPaper(input.kind)
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
    const docId = await createEngineImportPage(owner, input)
    admitted(
      await engineLog.start(docId, {
        ...blank,
        attrs: { ...blank.attrs, page: parsed.document.attrs.page },
      })
    )
    admitted(
      await engineLog.append(docId, {
        edit: createId(),
        origin: { kind: "import", actor: owner, client: "word-import" },
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
    return { docId, name: input.name, kind: input.kind, dropped: [...dropped] }
  })
}
