import { parsePaperId } from "@workspace/domain/kernel"
import { RICH_NATIVE_WRITER } from "@workspace/domain/paper-doc"
import { operation } from "@workspace/domain/operations/paper/edit"

import {
  undoOnlyReversal,
  type OperationBinding,
} from "../../../registry/bind.js"
import { readOutline } from "../../outline.js"
import { editRichPaper, RICH_UNDO_MOVED } from "../../rich-edit.js"

type EditOutput = Awaited<ReturnType<typeof editRichPaper>>

export const implementation = {
  operation,
  execute: (input, actor) =>
    editRichPaper(actor.userId, {
      ...input,
      writer: input.writer ?? RICH_NATIVE_WRITER,
      docId: parsePaperId(input.docId),
    }),
  basis: async (input, actor) =>
    (await readOutline(actor.userId, parsePaperId(input.docId), undefined))
      .revision,
  reversal: (input, output) => {
    if (!output.editId)
      return {
        irreversible: "Nothing was written, so there is nothing to undo.",
      }
    return undoOnlyReversal({
      command: "paper.undoEdit",
      input: {
        docId: input.docId,
        writer: RICH_NATIVE_WRITER,
        editId: output.editId,
        changes: output.changes,
      },
      expect: {
        query: "paper.outline",
        input: { docId: input.docId },
        matches: { revision: output.revision },
        skipped: RICH_UNDO_MOVED,
      },
    })
  },
  activity: (input, output) =>
    output.editId
      ? {
          subjectKind: "paper",
          subjectId: input.docId,
          summary: `Edited ${output.name}`,
          detail: { docId: input.docId, name: output.name },
        }
      : null,
} satisfies OperationBinding<typeof operation, EditOutput>
