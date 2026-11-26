import { parsePaperId } from "@workspace/domain/kernel"
import { operation } from "@workspace/domain/operations/paper/delete"
import type { OperationBinding } from "../../../registry/bind.js"
import { deletePaper } from "../../store.js"

export const implementation = {
  operation,
  execute: (input, actor) => deletePaper(actor, parsePaperId(input.docId)),
  reversal: (input, result) =>
    result.format === "word"
      ? {
          command: "paper.recover",
          input: { docId: input.docId },
          expect: {
            query: "paper.read",
            input: { view: "trash", docId: input.docId },
            matches: { deleted: true },
            skipped: "This page is already back, so Undo was skipped",
          },
        }
      : { irreversible: "A rich Paper is deleted for good." },
  activity: (_input, result) =>
    result.format === "word"
      ? {
          subjectKind: "paper",
          subjectId: result.id,
          summary: `Deleted ${result.name ?? "a Word page"}`,
        }
      : null,
} satisfies OperationBinding<
  typeof operation,
  import("zod").output<typeof operation.publicResult>
>
