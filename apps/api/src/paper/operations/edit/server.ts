import { catalog, parsePaperId } from "@workspace/domain/kernel"
import { RICH_NATIVE_WRITER } from "@workspace/domain/paper-doc"
import { operation } from "@workspace/domain/operations/paper/edit"

import {
  undoOnlyReversal,
  type OperationBinding,
} from "../../../registry/bind.js"
import {
  isPackageOutput,
  RICH_UNDO_MOVED,
  wordPackageReview,
  type EditOutput,
  type PackageCandidate,
  type Snapshot,
} from "../../package-edit.js"
import { editRichPaper } from "../../rich-edit.js"
import { WORD_UNDO_MOVED } from "../../word/document.js"

const noUndo = {
  irreversible: "Nothing was written, so there is nothing to undo.",
}

export const implementation = {
  operation,
  selected: {
    select: (input) =>
      typeof input.basedOn === "number" ? "execute" : "reviewed",
    execute: (input, actor) =>
      editRichPaper(actor.userId, {
        ...input,
        docId: parsePaperId(input.docId),
      }),
    reviewed: wordPackageReview,
  },
  reversal: (input, output) => {
    if (isPackageOutput(output)) {
      if (!output.restore || typeof input.basedOn !== "string") return noUndo
      return undoOnlyReversal({
        command: "paper.undoWord",
        input: {
          doc: output.docId,
          revision: output.revision,
          restore: input.basedOn,
        },
        expect: {
          query: catalog["paper.read"].name,
          input: { docId: output.docId },
          matches: { revision: output.revision },
          skipped: WORD_UNDO_MOVED,
        },
      })
    }
    if (!output.editId) return noUndo
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
  activity: (input, output) => {
    const saved = isPackageOutput(output)
      ? output.restore
        ? output
        : null
      : output.editId
        ? output
        : null
    return saved
      ? {
          subjectKind: "paper",
          subjectId: input.docId,
          summary: `Edited ${saved.name}`,
          detail: { docId: input.docId, name: saved.name },
        }
      : null
  },
} satisfies OperationBinding<
  typeof operation,
  EditOutput,
  PackageCandidate,
  unknown,
  Snapshot
>
