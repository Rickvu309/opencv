import { parseFileId, parseUserId } from "@workspace/domain/kernel"
import { operation } from "@workspace/domain/operations/paper/import"
import type { OperationBinding } from "../../../registry/bind.js"
import { createPaper, readFileMeta } from "../../store.js"

type Imported = { docId: string; name: string; kind: "cv" | "letter" }

export const implementation = {
  operation,
  execute: async (input, actor) => {
    await readFileMeta(parseUserId(actor.userId), parseFileId(input.fileId))
    const created = await createPaper(actor, {
      kind: input.kind,
      name: input.name,
      paper: input.paper,
    })
    return { docId: created.id, name: created.name, kind: input.kind }
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
