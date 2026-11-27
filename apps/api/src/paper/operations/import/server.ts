import { parseFileId, parseUserId } from "@workspace/domain/kernel"
import { operation } from "@workspace/domain/operations/paper/import"
import type { OperationBinding } from "../../../registry/bind.js"
import { importEnginePaper } from "../../engine-import.js"

type Imported = {
  docId: string
  name: string
  kind: "cv" | "letter"
  dropped?: string[]
}

export const implementation = {
  operation,
  execute: (input, actor) => {
    const owner = parseUserId(actor.userId)
    const fileId = parseFileId(input.fileId)
    return importEnginePaper(owner, { ...input, fileId })
  },
  reversal: {
    irreversible: "An imported Paper is removed by deleting it, not by Undo.",
  },
  activity: (_input, result) => ({
    subjectKind: "paper",
    subjectId: result.docId,
    summary: `Imported ${result.name}`,
  }),
} satisfies OperationBinding<typeof operation, Imported>
