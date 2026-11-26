import { operation } from "@workspace/domain/operations/paper/read"
import type { OperationBinding } from "../../../registry/bind.js"
import { parsePaperId } from "@workspace/domain/kernel"
import { readPaperDocumentInfo } from "../../document-info.js"
import { isWordPageDeleted } from "../../word-package/package-card-actions.js"
import { packageFailure } from "../../word-package/package-pages.js"
import {
  listWordPackages,
  readWordPackage,
} from "../../word-package/package-store.js"
import { readWordParagraphs } from "../../word-package/word-reading.js"
import { open } from "../../word-package/word/document.js"

async function readWordLines(owner: string, doc: string, at?: string) {
  const page = await open(
    owner,
    at ? { kind: "read", doc, at } : { kind: "read", doc }
  )
  return "refused" in page ? packageFailure(page.message) : page
}

async function trashState(userId: string, docId: string) {
  return { docId, deleted: await isWordPageDeleted(userId, docId) }
}

export const implementation = {
  operation,
  execute: (input, actor) => {
    if (!("view" in input)) return readWordPackage(actor.userId, input)
    if (input.view === "lines") return readWordParagraphs(actor.userId, input)
    if (input.view === "trash") return trashState(actor.userId, input.docId)
    if (input.view === "info")
      return readPaperDocumentInfo(
        actor.userId,
        parsePaperId(input.docId),
        input.writer
      )
    return input.view === "page"
      ? readWordLines(actor.userId, input.docId, input.at)
      : listWordPackages(actor.userId, input.after)
  },
} satisfies OperationBinding<
  typeof operation,
  | Awaited<ReturnType<typeof listWordPackages>>
  | Awaited<ReturnType<typeof readWordPackage>>
  | Awaited<ReturnType<typeof readWordLines>>
  | Awaited<ReturnType<typeof readWordParagraphs>>
  | Awaited<ReturnType<typeof trashState>>
  | Awaited<ReturnType<typeof readPaperDocumentInfo>>
>
