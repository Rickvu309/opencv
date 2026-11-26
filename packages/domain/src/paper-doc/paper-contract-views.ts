import { z } from "zod"

import { fileIdSchema, paperIdSchema, type FileId } from "../ids.js"
import { paperDocumentSchema } from "./document.js"
import { nativeBasisSchema, nativeProvenanceSchema } from "./native.js"
import {
  paperDocStatusSchema,
  paperStoredKindSchema,
  paperTemplateIdSchema,
} from "./paper.js"

export const paperCheckSchema = z
  .object({
    id: z.string(),
    kind: z.string(),
    message: z.string(),
    blockId: z.string().optional(),
    resolved: z.boolean().optional(),
  })
  .strict()

const paperPageChoiceSchema = z.enum(["unset", "keep"])

export const paperViewSchema = z
  .object({
    id: paperIdSchema,
    name: z.string(),
    kind: paperStoredKindSchema,
    templateId: paperTemplateIdSchema.nullable(),
    status: paperDocStatusSchema,
    paper: paperDocumentSchema,
    nativeBasis: nativeBasisSchema.optional(),
    contentVersion: z.number().int(),
    checks: z.array(paperCheckSchema),
    pageChoice: paperPageChoiceSchema,
    isFavorite: z.boolean(),
    sourceFileId: fileIdSchema.nullable(),
    format: z.enum(["word", "rich"]).optional(),
    preview: z.array(z.string()).optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()

export type PaperView = z.output<typeof paperViewSchema>

const paperIdentitySchema = paperViewSchema.pick({
  id: true,
  name: true,
  kind: true,
})

export const paperDocumentInfoSchema = z.discriminatedUnion("format", [
  paperIdentitySchema.extend({ format: z.enum(["word", "prose"]) }).strict(),
  paperIdentitySchema
    .extend({
      format: z.literal("rich"),
      provenance: nativeProvenanceSchema,
      updatedAt: z.string().datetime(),
    })
    .strict(),
])

export const PAPER_COACH_WORD_PAGE_NOTE =
  "This is a Word page. It has no document body in this result. Read its text with paper_outline before describing, reviewing or changing it."

export const paperCoachWordPageSchema = paperViewSchema
  .omit({ paper: true })
  .extend({
    format: z.literal("word"),
    content: z.string().nullable(),
    note: z.literal(PAPER_COACH_WORD_PAGE_NOTE),
  })
  .strict()

export type PaperCoachWordPage = z.output<typeof paperCoachWordPageSchema>

export type PaperFile = {
  id: FileId
  name: string
  mediaType: string
  byteSize: number
  createdAt: string
}
