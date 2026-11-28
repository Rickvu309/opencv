import { ERROR_CODES, parsePaperId } from "@workspace/domain/kernel"
import { type PaperView } from "@workspace/domain/paper-doc"
import { operation } from "@workspace/domain/operations/paper/duplicate"
import { CommandError } from "../../../platform/errors.js"
import type { OperationBinding } from "../../../registry/bind.js"
import { deleteNewPaper } from "../../new-paper-undo.js"
import {
  duplicatePaper,
  planDuplicate,
  type DuplicatePlan,
} from "../../store.js"

function duplicatePlan(value: unknown): DuplicatePlan {
  if (
    value &&
    typeof value === "object" &&
    "kind" in value &&
    (value.kind === "block" ||
      value.kind === "word" ||
      value.kind === "missing")
  )
    return value as DuplicatePlan
  throw new CommandError(
    ERROR_CODES.CONFLICT,
    "This copy is not available. No document was changed."
  )
}

export const implementation = {
  operation,
  prepare: (input, actor) => planDuplicate(actor, parsePaperId(input.docId)),
  execute: (input, actor, _registry, ahead?) =>
    duplicatePaper(actor, parsePaperId(input.docId), duplicatePlan(ahead)),
  reversal: (_input, result) => deleteNewPaper(result),
  activity: (_input, result) => ({
    subjectKind: "paper",
    subjectId: result.id,
    summary: `Duplicated ${result.name}`,
  }),
} satisfies OperationBinding<typeof operation, PaperView>
