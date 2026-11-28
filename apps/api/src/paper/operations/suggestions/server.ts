import { catalog, parsePaperId } from "@workspace/domain/kernel"
import { operation } from "@workspace/domain/operations/paper/suggestions"
import type { OperationBinding } from "../../../registry/bind.js"
import { openProposalsOn } from "../../../registry/proposals.js"
import { enginePaperOrNull } from "../../engine-paper.js"

const editInput = catalog["paper.edit"].input

export const implementation = {
  operation,
  async execute({ docId }, actor) {
    const paper = await enginePaperOrNull(actor.userId, parsePaperId(docId))
    if (!paper) return { suggestions: [] }
    const rows = await openProposalsOn(
      actor.userId,
      catalog["paper.edit"].name,
      docId
    )
    return {
      suggestions: rows.flatMap((row) => {
        const input = editInput.safeParse(row.input)
        if (!input.success || !input.data.commands) return []
        return [
          { id: row.id, summary: row.summary, commands: input.data.commands },
        ]
      }),
    }
  },
} satisfies OperationBinding<typeof operation>
