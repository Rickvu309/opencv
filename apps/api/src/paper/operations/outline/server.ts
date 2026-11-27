import { parsePaperId } from "@workspace/domain/kernel"
import { operation } from "@workspace/domain/operations/paper/outline"
import type { OperationBinding } from "../../../registry/bind.js"
import { enginePaperOrNull, readEngineOutline } from "../../engine-paper.js"
import { readOutline } from "../../outline.js"

export const implementation = {
  operation,
  execute: async (input, actor) => {
    const docId = parsePaperId(input.docId)
    const row = await enginePaperOrNull(actor.userId, docId)
    if (!row) return readOutline(actor.userId, docId, input.blockIds)
    return {
      name: row.name,
      kind: row.kind,
      status: row.status,
      ...(await readEngineOutline(docId, input.blockIds)),
    }
  },
} satisfies OperationBinding<typeof operation>
