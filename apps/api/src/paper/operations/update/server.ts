import { parsePaperId } from "@workspace/domain/kernel"
import {
  paperDocStatusSchema,
  paperViewSchema,
  RICH_NATIVE_WRITER,
} from "@workspace/domain/paper-doc"
import { operation } from "@workspace/domain/operations/paper/update"
import { z } from "zod"
import type { OperationBinding } from "../../../registry/bind.js"
import { updatePaper } from "../../store.js"

const privateResult = paperViewSchema
  .extend({
    previous: z
      .object({
        name: z.string().optional(),
        isFavorite: z.boolean().optional(),
        status: paperDocStatusSchema.optional(),
      })
      .strict(),
  })
  .strict()

export const implementation = {
  operation,
  privateResult,
  execute: (input, actor) =>
    updatePaper(actor, parsePaperId(input.docId), input.patch),
  reversal: (input, result) => ({
    command: operation.name,
    input: {
      docId: input.docId,
      patch: result.previous,
      ...(input.writer ? { writer: input.writer } : {}),
    },
    expect: {
      query: "paper.read",
      input: { view: "info", docId: input.docId, writer: RICH_NATIVE_WRITER },
      matches: { name: result.name },
      skipped: "This Paper was renamed again, so Undo was skipped",
    },
  }),
  activity: (input, result) => ({
    subjectKind: "paper",
    subjectId: input.docId,
    summary: `Updated ${result.name}`,
  }),
} satisfies OperationBinding<typeof operation, z.output<typeof privateResult>>
