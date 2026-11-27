import { parsePaperId } from "@workspace/domain/kernel"
import { RICH_NATIVE_WRITER } from "@workspace/domain/paper-doc"
import { operation } from "@workspace/domain/operations/paper/read"
import type { OperationBinding } from "../../../registry/bind.js"
import { readPaperDocumentInfo } from "../../document-info.js"
import { enginePaperOrNull, readEngineOutline } from "../../engine-paper.js"
import { readEnginePaper } from "../../engine-sync-log.js"
import { readOutline } from "../../outline.js"
import { listPapers } from "../../store.js"

export const implementation = {
  operation,
  execute: async (input, actor) => {
    if (!("docId" in input)) {
      const papers = await listPapers(
        actor.userId,
        undefined,
        undefined,
        RICH_NATIVE_WRITER
      )
      return {
        items: papers.map((paper) => ({
          docId: paper.id,
          name: paper.name,
          kind: paper.kind,
        })),
        next: null,
      }
    }
    const docId = parsePaperId(input.docId)
    if ("view" in input) {
      if (input.view === "engine") return readEnginePaper(actor.userId, docId)
      return readPaperDocumentInfo(actor.userId, docId, input.writer)
    }
    const engine = await enginePaperOrNull(actor.userId, docId)
    if (engine)
      return {
        docId: input.docId,
        name: engine.name,
        kind: engine.kind,
        ...(await readEngineOutline(docId, undefined)),
      }
    const info = await readPaperDocumentInfo(
      actor.userId,
      docId,
      RICH_NATIVE_WRITER
    )
    const outline = await readOutline(actor.userId, docId, undefined)
    return {
      docId: input.docId,
      name: info.name,
      kind: info.kind,
      revision: outline.revision,
      nativeBasis: outline.nativeBasis,
      outline: outline.outline,
      truncated: outline.truncated,
    }
  },
} satisfies OperationBinding<typeof operation>
