import { z } from "zod"

import { queryContract, queryEntry } from "./contract.js"
import { fileIdSchema, paperIdSchema } from "./ids.js"
import { paperDocumentSchema } from "./paper-doc/document.js"
import {
  nativeBasisSchema,
  nativeProvenanceSchema,
  nativeWriterSchema,
} from "./paper-doc/native.js"
import {
  paperDocStatusSchema,
  paperKeywordGapInputSchema,
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

const paperSharedViewSchema = paperViewSchema
  .pick({ id: true, name: true, kind: true, templateId: true, paper: true })
  .extend({
    paper: paperDocumentSchema.refine((paper) => paper.clashes.length === 0),
  })
  .strict()

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

const paperFileSchema = z
  .object({
    id: fileIdSchema,
    name: z.string(),
    mediaType: z.string(),
    byteSize: z.number().int(),
    createdAt: z.string().datetime(),
  })
  .strict()

export type PaperFile = z.output<typeof paperFileSchema>

const paperPagesSchema = z
  .object({
    docId: paperIdSchema,
    pages: z.number().int().positive(),
    pageChoice: paperPageChoiceSchema,
  })
  .strict()

export type PaperPages = z.output<typeof paperPagesSchema>

const empty = z.object({}).strict()

const blockIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)

export const paperQueries = queryContract({
  "paper.document": queryEntry({
    input: z
      .object({ docId: paperIdSchema, writer: nativeWriterSchema.optional() })
      .strict(),
    output: paperDocumentInfoSchema,
  }),
  "paper.list": queryEntry({
    input: z
      .object({
        query: z.string().optional(),
        writer: nativeWriterSchema.optional(),
        kind: paperStoredKindSchema.optional(),
      })
      .strict(),
    output: z.array(paperViewSchema),
  }),
  "paper.get": queryEntry({
    input: z
      .object({ docId: paperIdSchema, writer: nativeWriterSchema.optional() })
      .strict(),
    output: paperViewSchema,
  }),
  "paper.isDeleted": queryEntry({
    input: z.object({ docId: paperIdSchema }).strict(),
    output: z.object({ docId: paperIdSchema, deleted: z.boolean() }).strict(),
  }),
  "paper.pageCount": queryEntry({
    input: z
      .object({ docId: paperIdSchema, writer: nativeWriterSchema.optional() })
      .strict(),
    output: paperPagesSchema,
  }),
  "paper.shared": queryEntry({
    input: z
      .object({
        token: z.string().min(8),
        writer: nativeWriterSchema.optional(),
      })
      .strict(),
    output: paperSharedViewSchema,
  }),
  "file.get": queryEntry({
    input: z.object({ fileId: fileIdSchema }).strict(),
    output: paperFileSchema.omit({ createdAt: true }),
  }),
  "paper.files": queryEntry({
    input: empty,
    output: z.array(paperFileSchema),
  }),
  "paper.outline": queryEntry({
    input: z
      .object({
        docId: paperIdSchema,
        blockIds: z.array(blockIdSchema).max(50).optional(),
        writer: nativeWriterSchema.optional(),
        cursor: z.string().min(1).max(2048).optional(),
      })
      .strict(),
    output: z
      .object({
        revision: z.union([z.number().int(), z.string().uuid()]),
        nativeBasis: nativeBasisSchema.optional(),
        outline: z.string(),
        truncated: z.boolean(),
        nextCursor: z.string().max(2048).nullable().optional(),
        omittedParagraphs: z.number().int().nonnegative().optional(),
        omittedChars: z.number().int().nonnegative().optional(),
      })
      .strict(),
  }),
  "paper.keywordGap": queryEntry({
    input: paperKeywordGapInputSchema,
    output: z
      .object({ keyword: z.string(), sentence: z.string() })
      .strict()
      .nullable(),
  }),
})
