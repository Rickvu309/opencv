import { parsePaperId } from "@workspace/domain/kernel"
import {
  RICH_NATIVE_WRITER,
  type AgentCommand,
} from "@workspace/domain/paper-doc"
import { operation } from "@workspace/domain/operations/paper/edit"

import {
  undoOnlyReversal,
  type OperationBinding,
} from "../../../registry/bind.js"
import {
  applyEngineEdit,
  dryRunEngineEdit,
  NEWER_COACH_CHANGE_FIRST,
} from "../../engine-paper.js"
import { readOutline } from "../../outline.js"
import { editRichPaper, RICH_UNDO_MOVED } from "../../rich-edit.js"

type EditOutput =
  | Awaited<ReturnType<typeof editRichPaper>>
  | Awaited<ReturnType<typeof applyEngineEdit>>

export const implementation = {
  operation,
  execute: (input, actor): Promise<EditOutput> =>
    input.commands
      ? applyEngineEdit(
          {
            ...input,
            docId: parsePaperId(input.docId),
            commands: input.commands as AgentCommand[],
          },
          actor
        )
      : editRichPaper(actor.userId, {
          ...input,
          writer: input.writer ?? RICH_NATIVE_WRITER,
          docId: parsePaperId(input.docId),
          edits: input.edits ?? [],
        }),
  basis: async (input, actor) =>
    input.commands
      ? dryRunEngineEdit(
          {
            ...input,
            docId: parsePaperId(input.docId),
            commands: input.commands as AgentCommand[],
          },
          actor
        )
      : (await readOutline(actor.userId, parsePaperId(input.docId), undefined))
          .revision,
  reversal: (input, output) => {
    if (!output.editId)
      return {
        irreversible: "Nothing was written, so there is nothing to undo.",
      }
    if (input.commands)
      return undoOnlyReversal({
        command: "paper.revert",
        input: { docId: input.docId, edit: output.editId },
        expect: {
          query: "paper.outline",
          input: { docId: input.docId },
          matches: { engine: 2 },
          skipped: NEWER_COACH_CHANGE_FIRST,
        },
      })
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
