import { parsePaperId } from "@workspace/domain/kernel"
import { z } from "zod"

import type { Registry } from "../../../registry/registry.js"
import { revertEngineEdit } from "../../engine-paper.js"

const revertSchema = z
  .object({
    docId: z.string().uuid(),
    edit: z.string().min(1).max(200),
  })
  .strict()

export function registerPaperRevert(registry: Registry) {
  registry.addUndoCommand(
    {
      name: "paper.revert",
      description:
        "Take back one accepted Paper change by reverting its steps through later edits.",
      input: revertSchema,
      coach: "never",
      destructive: false,
      idempotency: "keyed",
      reversal: () => null,
      step: () => "Undo a suggested Paper change",
      activity: () => null,
    },
    (input, actor) =>
      revertEngineEdit(actor.userId, {
        docId: parsePaperId(input.docId),
        edit: input.edit,
      })
  )
}
