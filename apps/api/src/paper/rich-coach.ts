import { randomUUID } from "node:crypto"
import {
  ERROR_CODES,
  RICH_NATIVE_WRITER,
  canonicalPaper,
  paperContract,
  prepareRichEdit,
  reverseRichChanges,
  richReviewSchema,
  richTextNodes,
  richPaperDocumentSchema,
  type NativeWriter,
  type PaperId,
  type UserId,
} from "@workspace/domain"
import { loadYDoc, materializeStored } from "@workspace/paper-crdt"
import { z } from "zod"
import { paperDocs } from "../db/schema.js"
import { tableQuery } from "../registry/bind.js"
import { CommandError } from "../registry/errors.js"
import type { ReviewedCommand } from "../registry/frozen-review.js"
import type { Registry } from "../registry/registry.js"
import { withRichContent } from "./content-store.js"

type Input = z.output<(typeof paperContract)["paper.editRich"]["input"]>
type Output = z.output<(typeof paperContract)["paper.editRich"]["output"]>
const candidateSchema = z
  .object({
    owner: z.string(),
    docId: z.string().uuid(),
    epoch: z.number().int(),
    revision: z.number().int(),
    editId: z.string().uuid(),
  })
  .strict()

function conflict(message: string): never {
  throw new CommandError(ERROR_CODES.CONFLICT, message)
}

async function prepare(userId: UserId, input: Input) {
  return withRichContent(userId, input.docId, input.writer, async (content) => {
    if (canonicalPaper(content.basis) !== canonicalPaper(input.basis))
      return conflict(
        "The document changed. Read it again and propose a new edit. Nothing was changed."
      )
    try {
      const plan = prepareRichEdit(content.document, input.edits)
      return {
        ...plan,
        review: richReviewSchema.parse({
          format: "rich",
          docId: input.docId,
          name: content.row.name,
          changes: plan.changes,
        }),
      }
    } catch (error) {
      return conflict(
        error instanceof Error ? error.message : "This edit cannot be prepared"
      )
    }
  })
}

const reviewed: ReviewedCommand<
  Input,
  Output,
  z.output<typeof candidateSchema>,
  z.output<typeof richReviewSchema>
> = {
  version: "rich-paper-text-1",
  candidate: candidateSchema,
  review: richReviewSchema,
  basis: {
    table: paperDocs,
    key: [
      { column: paperDocs.id, source: "candidate", field: "docId" },
      { column: paperDocs.userId, source: "candidate", field: "owner" },
      { column: paperDocs.crdtEpoch, source: "candidate", field: "epoch" },
    ],
    compared: [
      {
        column: paperDocs.contentVersion,
        source: "candidate",
        field: "revision",
      },
    ],
  },
  prepare: async (input, actor) => {
    const plan = await prepare(actor.userId, input)
    return {
      candidate: {
        owner: actor.userId,
        docId: input.docId,
        epoch: input.basis.epoch,
        revision: input.basis.revision,
        editId: randomUUID(),
      },
      review: plan.review,
    }
  },
  revalidate: async (input, prepared, actor) => {
    if (prepared.candidate.owner !== actor.userId)
      return conflict("This proposal belongs to another person")
    const plan = await prepare(actor.userId, input)
    if (canonicalPaper(plan.review) !== canonicalPaper(prepared.review))
      return conflict(
        "This proposal changed. Read the document and propose again."
      )
  },
  commit: async (input, prepared, actor, locked) => {
    const candidate = prepared.candidate
    if (
      candidate.owner !== actor.userId ||
      canonicalPaper(locked.key) !==
        canonicalPaper([input.docId, actor.userId, input.basis.epoch]) ||
      canonicalPaper(locked.compared) !== canonicalPaper([input.basis.revision])
    )
      return conflict(
        "The document changed. Read it again and propose a new edit."
      )
    return withRichContent(
      actor.userId,
      input.docId,
      input.writer,
      async (content) => {
        if (canonicalPaper(content.basis) !== canonicalPaper(input.basis))
          return conflict("The document changed. Nothing was changed.")
        const plan = prepareRichEdit(content.document, input.edits)
        if (
          canonicalPaper(plan.changes) !==
          canonicalPaper(prepared.review.changes)
        )
          return conflict("This proposal no longer matches its review")
        const row = await content.edit(plan.document, {
          origin: "coach",
          editId: candidate.editId,
          touched: plan.changes.map((change) => change.blockId),
        })
        return {
          ...prepared.review,
          revision: row.contentVersion,
          editId: candidate.editId,
        }
      }
    )
  },
}

export function registerRichCoach(
  registry: Registry,
  entry: (typeof paperContract)["paper.editRich"]
) {
  registry.addReviewedCommand(
    {
      name: "paper.editRich",
      description: entry.description,
      delegate: entry.delegate,
      input: entry.input,
      coach: entry.coach,
      destructive: entry.destructive,
      idempotency: "keyed",
      step: entry.step,
      reversal: (input, output) => ({
        command: "paper.revertEdit",
        input: {
          docId: input.docId,
          editId: output.editId,
          writer: input.writer,
        },
        expect: {
          query: "paper.document",
          input: { docId: input.docId, writer: input.writer },
          matches: { format: "rich" },
          skipped:
            "This document changed format. Undo was skipped to keep your writing.",
        },
      }),
      activity: (input, output) => ({
        subjectKind: "paper",
        subjectId: input.docId,
        summary: `Edited ${output.name}`,
        detail: { docId: input.docId, name: output.name },
      }),
    },
    reviewed
  )
  registry.addQuery(
    tableQuery("paper.readRich", {
      description: `Read text and formatting of a rich CV or Letter, including selected blockIds. Use writer ${JSON.stringify(RICH_NATIVE_WRITER)}. Copy the returned basis unchanged into paper.editRich. Tables, photos and layout are outside Coach editing.`,
      coach: true,
      step: () => "Read the rich document",
      read: (input, actor) =>
        withRichContent(
          actor.userId,
          input.docId,
          input.writer,
          async (content) => {
            const selected = new Set(input.blockIds ?? [])
            const outline = JSON.stringify(
              richTextNodes(content.document).map((node) => ({
                id: node.id,
                type: node.type,
                selected: selected.has(node.id),
                content: node.content,
              }))
            )
            if (outline.length > 200000)
              return conflict("This document is too long for a Coach review")
            return {
              docId: input.docId,
              name: content.row.name,
              kind: content.document.kind,
              basis: content.basis,
              outline,
            }
          }
        ),
    })
  )
}

export async function revertRichCoachEdit(
  userId: UserId,
  docId: PaperId,
  editId: string,
  writer: NativeWriter
) {
  return withRichContent(userId, docId, writer, async (content) => {
    const history = await content.history()
    if (
      history.rows.some(
        (row) => row.origin === "revert" && row.editId === editId
      )
    )
      return { revision: content.row.contentVersion, reverted: false }
    const target = history.rows.find(
      (row) => row.origin === "coach" && row.editId === editId
    )
    if (!target)
      return conflict(
        "This Coach edit is no longer available. Undo was skipped; your writing is unchanged."
      )
    const image = (seq: number) => {
      const doc = loadYDoc(
        history.base,
        history.rows.filter((row) => row.seq <= seq).map((row) => row.update)
      )
      try {
        const read = materializeStored(doc)
        if (!read.ok) return conflict(read.reason)
        return richPaperDocumentSchema.parse(read.document)
      } finally {
        doc.destroy()
      }
    }
    const before = new Map(
      richTextNodes(image(target.seq - 1)).map((node) => [
        node.id,
        node.content,
      ])
    )
    const changes = richTextNodes(image(target.seq)).flatMap((node) => {
      const previous = before.get(node.id)
      return previous &&
        canonicalPaper(previous) !== canonicalPaper(node.content)
        ? [{ blockId: node.id, before: previous, after: node.content }]
        : []
    })
    if (!changes.length)
      return conflict("This Coach edit cannot be safely reversed")
    let document
    try {
      document = reverseRichChanges(content.document, changes)
    } catch (error) {
      return conflict(
        error instanceof Error
          ? error.message
          : "Undo was skipped to keep your writing"
      )
    }
    const row = await content.edit(document, {
      origin: "revert",
      editId,
      touched: changes.map((change) => change.blockId),
    })
    return { revision: row.contentVersion, reverted: true }
  })
}
