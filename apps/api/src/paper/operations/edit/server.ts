import { parsePaperId } from "@workspace/domain/kernel"
import type { AgentCommand } from "@workspace/domain/paper-doc"
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

type EditInput = import("zod").output<typeof operation.input>

function engineEdit(input: EditInput) {
  return {
    ...input,
    docId: parsePaperId(input.docId),
    commands: input.commands as AgentCommand[],
  }
}

export const implementation = {
  operation,
  execute: (input, actor) => applyEngineEdit(engineEdit(input), actor),
  basis: (input, actor) => dryRunEngineEdit(engineEdit(input), actor),
  reversal: (input, output) =>
    output.editId
      ? undoOnlyReversal({
          command: "paper.revert",
          input: { docId: input.docId, edit: output.editId },
          expect: {
            query: "paper.outline",
            input: { docId: input.docId },
            matches: { engine: 2 },
            skipped: NEWER_COACH_CHANGE_FIRST,
          },
        })
      : { irreversible: "Nothing was written, so there is nothing to undo." },
  activity: (input, output) =>
    output.editId
      ? {
          subjectKind: "paper",
          subjectId: input.docId,
          summary: `Edited ${output.name}`,
          detail: { docId: input.docId, name: output.name },
        }
      : null,
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof applyEngineEdit>>
>
