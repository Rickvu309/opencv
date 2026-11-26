import { randomUUID } from "node:crypto"

import {
  ERROR_CODES,
  paperIdSchema,
  type PaperId,
  type UserId,
} from "@workspace/domain/kernel"
import {
  canonicalPaper,
  nativeWriterSchema,
  prepareRichEdit,
  reverseRichChanges,
  richChangeSchema,
  richTextEditsSchema,
  type NativeBasis,
  type NativeWriter,
  type RichChange,
} from "@workspace/domain/paper-doc"
import { z } from "zod"

import { CommandError } from "../platform/errors.js"
import type { Registry } from "../registry/registry.js"
import { rewriteRichContent } from "./content/content-store.js"
import { admitDocument } from "./content/native-admission.js"
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

export const RICH_UNDO_MOVED =
  "This document changed after the Coach edit, so Undo was skipped to keep your writing."

const richUndoSchema = z
  .object({
    docId: paperIdSchema,
    writer: nativeWriterSchema,
    editId: z.string().uuid(),
    changes: z.array(richChangeSchema).min(1).max(30),
  })
  .strict()

export function registerRichUndo(registry: Registry) {
  registry.addUndoCommand(
    {
      name: "paper.undoEdit",
      description:
        "Put back the passages a Coach edit changed on a rich Paper.",
      input: richUndoSchema,
      coach: "never",
      destructive: false,
      idempotency: "keyed",
      reversal: () => null,
      step: () => "Undo a Coach edit",
      activity: () => null,
    },
    (input, actor) => undoRichEdit(actor.userId, input)
  )
}
