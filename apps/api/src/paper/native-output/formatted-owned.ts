import { paperPhotoFileId, parseFileId, type UserId } from "@workspace/domain"
import {
  layoutDocumentSchema,
  flowDocumentSchema,
  type FlowDocument,
  type FormatNode,
  type LayoutRow,
  type LayoutCell,
  type FlowSection,
  refuse,
  type Result,
} from "@workspace/domain/internal/paper-presentation"
import { readOwnedPhoto } from "../store.js"
import { compileLayoutNativeDocx, compileFlowNativeDocx } from "./formatted.js"
import { insideTransaction } from "../../db/context.js"
import type { PhotoMedia } from "./formatted-photos.js"

export async function compileOwnedLayoutNativeDocx(input: {
  userId: UserId
  document: unknown
}): Promise<Result<Uint8Array>> {
  try {
    const document = layoutDocumentSchema.parse(input.document)
    const photos = document.flow.children.flatMap((node) =>
      node.type === "photo"
        ? [node]
        : node.type === "table"
          ? node.children.flatMap((row) =>
              row.children.flatMap((cell) =>
                cell.children.flatMap((child) =>
                  child.type === "photo" ? [child] : []
                )
              )
            )
          : []
    )
    const sources = [...new Set(photos.map((photo) => photo.source))]
    if (sources.length > 100) throw new Error("Too many document photos")
    const media: PhotoMedia[] = []
    for (const source of sources) {
      const fileId = paperPhotoFileId(source)
      if (!fileId) throw new Error("Photo requires an owned file reference")
      const resolved = await readOwnedPhoto(input.userId, parseFileId(fileId))
      const { mediaType, bytes } = resolved
      if (
        mediaType !== "image/png" &&
        mediaType !== "image/jpeg" &&
        mediaType !== "image/gif"
      )
        throw new Error("Word photo output needs PNG, JPEG or GIF media")
      media.push({ source, mediaType, bytes: new Uint8Array(bytes) })
    }
    return compileLayoutNativeDocx({ document, photos: media })
  } catch (error) {
    return refuse(
      error instanceof Error ? error.message : "Owned photo output refused"
    )
  }
}

export async function compileOwnedFlowNativeDocx(input: {
  userId: UserId
  document: unknown
}): Promise<Result<Uint8Array>> {
  try {
    if (!insideTransaction())
      throw new Error("Word download must own its snapshot")
    const document = flowDocumentSchema.parse(input.document)
    const sources = new Set<string>()
    const visit = (
      node:
        | FlowDocument["flow"]
        | FlowSection
        | FlowSection["children"][number]
        | FormatNode
        | LayoutRow
        | LayoutCell
    ) => {
      if (node.type === "photo") sources.add(node.source)
      if (node.type === "header" && node.photo !== undefined)
        sources.add(node.photo)
      if ("children" in node) node.children.forEach(visit)
    }
    visit(document.flow)
    if (sources.size > 100) throw new Error("Too many document photos")
    const media: PhotoMedia[] = []
    for (const source of [...sources].sort()) {
      const fileId = paperPhotoFileId(source)
      if (!fileId) throw new Error("Photo requires an owned file reference")
      const resolved = await readOwnedPhoto(input.userId, parseFileId(fileId), {
        lock: true,
      })
      const { mediaType, bytes } = resolved
      if (
        mediaType !== "image/png" &&
        mediaType !== "image/jpeg" &&
        mediaType !== "image/gif"
      )
        throw new Error("Word photo output needs PNG, JPEG or GIF media")
      media.push({ source, mediaType, bytes: new Uint8Array(bytes) })
    }
    return compileFlowNativeDocx({ document, photos: media })
  } catch (error) {
    return refuse(
      error instanceof Error ? error.message : "Owned photo output refused"
    )
  }
}
