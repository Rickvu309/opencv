import { randomUUID } from "node:crypto"

import {
  ERROR_CODES,
  type PaperId,
  type UserId,
} from "@workspace/domain/kernel"
import {
  canonicalPaper,
  prepareRichEdit,
  reverseRichChanges,
  richTextEditsSchema,
  type NativeBasis,
  type NativeWriter,
  type RichChange,
} from "@workspace/domain/paper-doc"

import { CommandError } from "../platform/errors.js"
import { rewriteRichContent } from "./content-store.js"
import { admitDocument } from "./native-admission.js"
import { richBasis } from "./rich-outline.js"

function conflict(message: string): never {
  throw new CommandError(ERROR_CODES.CONFLICT, message)
}

function reason(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export async function editRichPaper(
  userId: UserId,
  input: {
    docId: PaperId
    basedOn: number | string
    writer?: NativeWriter
    nativeBasis?: NativeBasis
    edits: unknown
  }
) {
  const edits = richTextEditsSchema.parse(input.edits)
  const { writer, nativeBasis } = input
  if (!writer || !nativeBasis)
    return conflict(
      "Read the document with paper.outline and send its basis and the rich editor's writer. Nothing was changed."
    )
  const editId = randomUUID()
  return rewriteRichContent(userId, input.docId, (row, document) => {
    admitDocument(document, writer)
    if (
      input.basedOn !== row.contentVersion ||
      canonicalPaper(richBasis(row, document)) !== canonicalPaper(nativeBasis)
    )
      return conflict(
        "The document changed. Read it again and propose a new edit. Nothing was changed."
      )
    let plan: ReturnType<typeof prepareRichEdit>
    try {
      plan = prepareRichEdit(document, edits)
    } catch (error) {
      return conflict(reason(error, "This edit cannot be prepared"))
    }
    return {
      target: plan.document,
      change: {
        origin: "coach",
        editId,
        touched: plan.changes.map((change) => change.blockId),
      },
      result: (written) => ({
        format: "rich" as const,
        docId: input.docId,
        name: row.name,
        changes: plan.changes,
        revision: written.contentVersion,
        editId,
      }),
    }
  })
}

export async function undoRichEdit(
  userId: UserId,
  input: {
    docId: PaperId
    writer: NativeWriter
    editId: string
    changes: RichChange[]
  }
) {
  return rewriteRichContent(userId, input.docId, (row, document) => {
    admitDocument(document, input.writer)
    let target: ReturnType<typeof reverseRichChanges>
    try {
      target = reverseRichChanges(document, input.changes)
    } catch (error) {
      return conflict(reason(error, "Undo was skipped to keep your writing"))
    }
    return {
      target,
      change: {
        origin: "revert",
        editId: input.editId,
        touched: input.changes.map((change) => change.blockId),
      },
      result: (written) => ({
        docId: input.docId,
        revision: written.contentVersion,
      }),
    }
  })
}
