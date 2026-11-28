import { readFile } from "node:fs/promises"

import {
  parseFileId,
  parsePaperId,
  type PaperId,
  type UserId,
} from "@workspace/domain/kernel"
import { operation } from "@workspace/domain/operations/paper/export"
import { createLayouter, paperFontMetrics } from "@workspace/paper-engine"

import manifest from "../../../../../../packages/paper-fonts/fonts.json" with { type: "json" }
import { transaction } from "../../../db/context.js"
import type { OperationBinding } from "../../../registry/bind.js"
import { readEnginePaper } from "../../engine-sync-log.js"
import { photoReferences } from "../../log/index.js"
import { writePdf } from "../../pdf/write-pdf.js"
import { mediaTypeFromImageBytes, readOwnedPhoto } from "../../store.js"
import { writeDocx } from "../../word/write-docx.js"

const fontDirectory = new URL(
  "../../../../../web/public/fonts/",
  import.meta.url
)

function paperFonts() {
  return Promise.all(
    manifest.faces.map(
      async ({ face, file }) =>
        [face, await readFile(new URL(file, fontDirectory))] as const
    )
  ).then((faces) => new Map(faces))
}

async function exportEnginePaper(
  owner: UserId,
  docId: PaperId,
  format: "docx" | "pdf"
) {
  const { doc, name, images } = await transaction(async () => {
    const paper = await readEnginePaper(owner, docId)
    const images = await Promise.all(
      photoReferences(paper.doc).map(async (id) => {
        const fileId = parseFileId(id)
        const { bytes } = await readOwnedPhoto(owner, fileId, { lock: true })
        return [
          fileId,
          { bytes, mediaType: mediaTypeFromImageBytes(bytes) },
        ] as const
      })
    )
    return { ...paper, images }
  })
  if (format === "docx")
    return {
      name,
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" as const,
      base64: writeDocx(doc, new Map(images)).toString("base64"),
    }
  const layout = createLayouter(paperFontMetrics).layout(doc, null)
  const pdfImages = new Map(images.map(([id, image]) => [id, image.bytes]))
  const pdf = await writePdf(layout, pdfImages, await paperFonts())
  return {
    name,
    contentType: "application/pdf" as const,
    base64: pdf.toString("base64"),
  }
}

export const implementation = {
  operation,
  execute: (input, actor) =>
    exportEnginePaper(actor.userId, parsePaperId(input.docId), input.format),
} satisfies OperationBinding<
  typeof operation,
  import("zod").output<typeof operation.publicResult>
>
