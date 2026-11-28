import { parsePaperId } from "@workspace/domain/kernel"
import { operation } from "@workspace/domain/operations/paper/read"
import type { OperationBinding } from "../../../registry/bind.js"
import { readPaperDocumentInfo } from "../../document-info.js"
import { readEnginePaper } from "../../engine-sync-log.js"
import { readOutline } from "../../outline.js"
import { listPapers } from "../../store.js"

export const implementation = {
  operation,
  execute: async (input, actor) => {
    if (!("docId" in input)) {
      const papers = await listPapers(actor.userId)
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
      return readPaperDocumentInfo(actor.userId, docId)
    }
    const { name, kind, revision, outline, truncated, engine } =
      await readOutline(actor.userId, docId, undefined)
    return {
      docId: input.docId,
      name,
      kind,
      revision,
      outline,
      truncated,
      engine,
    }
  },
} satisfies OperationBinding<typeof operation>
