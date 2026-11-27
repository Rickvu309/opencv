import { z } from "zod"

import { fileIdSchema, paperIdSchema, type FileId } from "../ids.js"
import { layoutPageSchema } from "./engine-page.js"
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
    format: z.literal("rich").optional(),
    preview: z.array(z.string()).optional(),
    firstPage: layoutPageSchema.optional(),
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
  paperIdentitySchema.extend({ format: z.literal("prose") }).strict(),
  paperIdentitySchema
    .extend({
      format: z.literal("rich"),
      provenance: nativeProvenanceSchema,
      updatedAt: z.string().datetime(),
    })
    .strict(),
])

export const paperImportResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({
        docId: z.string().uuid(),
        name: z.string().min(1).max(200),
        kind: z.enum(["cv", "letter"]),
        notice: z.string().min(1).optional(),
        dropped: z.array(z.string().min(1)).optional(),
      })
      .strict(),
  })
  .strict()

export type PaperFile = {
  id: FileId
  name: string
  mediaType: string
  byteSize: number
  createdAt: string
}
