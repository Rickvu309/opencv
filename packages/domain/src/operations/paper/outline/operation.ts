import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import type { ResourceRef } from "../../../resources.js"
import {
  nativeBasisSchema,
  nativeWriterSchema,
} from "../../../paper-doc/native.js"

export const operation = defineOperation({
  owner: "paper",
  name: "paper.outline",
  version: 1,
  kind: "read",
  description:
    "Read a bounded outline of a document with block ids, kinds, section titles, heading levels, marks and links, and the revision to pass as basedOn. Pass blockIds to mark selected blocks. For native version 4 Letters, declare writer documentVersion 4, writerProtocol 1, supportedSchemaRevisions [1], capabilities structured-prose and underline; copy the returned nativeBasis unchanged into paper.edit. If truncated, pass nextCursor as cursor to read the next Word part at the same saved revision.",
  input: z
    .object({
      docId: z.string().uuid(),
      blockIds: z
        .array(z.string().regex(/^[A-Za-z0-9_-]{1,64}$/))
        .max(50)
        .optional(),
      writer: nativeWriterSchema.optional(),
      cursor: z.string().min(1).max(2048).optional(),
    })
    .strict(),
  publicResult: z
    .object({
      revision: z.union([z.number().int(), z.string().uuid()]),
      nativeBasis: nativeBasisSchema.optional(),
      outline: z.string(),
      truncated: z.boolean(),
      nextCursor: z.string().max(2048).nullable().optional(),
      omittedParagraphs: z.number().int().nonnegative().optional(),
      omittedChars: z.number().int().nonnegative().optional(),
    })
    .strip(),
  coach: "auto",
  dependsOn: (input): readonly ResourceRef[] => [
    { name: "paper", coachFloor: "auto", entityId: input.docId },
  ],
})
