import { z } from "zod"

import { PAPER_COMMANDS } from "./commands.js"
import { fileIdSchema, jobIdSchema, paperIdSchema } from "./ids.js"

export { PAPER_COMMANDS }

export const PAPER_CONTENT_VERSION = 1
export const PAPER_DOC_NAME_MAX = 200

export const PAPER_KIND_LABEL = {
  cv: "CV",
  letter: "Letter",
  proof: "Proof",
} as const

export const DEFAULT_PAPER_DOC_NAME = {
  cv: "Untitled CV",
  letter: "Untitled Letter",
  proof: "Untitled Proof",
} as const

export const paperContentKindSchema = z.enum(["cv", "letter", "proof"])
export const paperDocStatusSchema = z.enum(["draft", "ready", "published"])

export const paperDocIdSchema = paperIdSchema

export const paperDocNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(PAPER_DOC_NAME_MAX, "Name is too long")

export const paperContentVersionSchema = z
  .number()
  .int()
  .positive("Content version must be a positive integer")

export const paperCreateDocInputSchema = z
  .object({
    kind: paperContentKindSchema,
    name: paperDocNameSchema.optional(),
    content: z.unknown().optional(),
  })
  .strict()

export const paperUpdateContentInputSchema = z
  .object({
    docId: paperDocIdSchema,
    content: z.unknown(),
    contentVersion: paperContentVersionSchema,
  })
  .strict()

export const paperRenameDocInputSchema = z
  .object({
    docId: paperDocIdSchema,
    name: paperDocNameSchema,
  })
  .strict()

export const paperSetStatusInputSchema = z
  .object({
    docId: paperDocIdSchema,
    status: paperDocStatusSchema,
  })
  .strict()

export const paperDeleteDocInputSchema = z
  .object({
    docId: paperDocIdSchema,
  })
  .strict()

export const paperLinkApplyCardInputSchema = z
  .object({
    docId: paperDocIdSchema,
    applyCardId: z.string().uuid().nullable(),
  })
  .strict()

export const paperListDocsInputSchema = z.object({}).strict()

export const paperGetDocInputSchema = z
  .object({
    docId: paperDocIdSchema,
  })
  .strict()

export type PaperContentKind = z.infer<typeof paperContentKindSchema>
export type PaperDocStatus = z.infer<typeof paperDocStatusSchema>
export type PaperCreateDocInput = z.infer<typeof paperCreateDocInputSchema>
export type PaperUpdateContentInput = z.infer<
  typeof paperUpdateContentInputSchema
>
export type PaperRenameDocInput = z.infer<typeof paperRenameDocInputSchema>
export type PaperSetStatusInput = z.infer<typeof paperSetStatusInputSchema>
export type PaperDeleteDocInput = z.infer<typeof paperDeleteDocInputSchema>
export type PaperLinkApplyCardInput = z.infer<
  typeof paperLinkApplyCardInputSchema
>
export type PaperListDocsInput = z.infer<typeof paperListDocsInputSchema>
export type PaperGetDocInput = z.infer<typeof paperGetDocInputSchema>

export type PaperDocDeleted = {
  id: string
}

export type PaperDoc = {
  id: string
  name: string
  kind: PaperContentKind
  status: PaperDocStatus
  content: unknown
  contentVersion: number
  applyCardId: string | null
  createdAt: string
  updatedAt: string
}

export const PAPER_TEMPLATE_IDS = [
  "simple",
  "modern",
  "compact",
  "two-column",
  "creative",
  "with-photo",
  "blank",
  "classic",
  "centered",
  "minimal",
  "shaded",
  "bold",
  "academic",
  "clean",
  "ledger",
  "graduate",
] as const

export const paperTemplateIdSchema = z.enum(PAPER_TEMPLATE_IDS)
export type PaperTemplateId = z.infer<typeof paperTemplateIdSchema>

export const paperStoredKindSchema = z.enum(["cv", "letter"])
export type PaperStoredKind = z.infer<typeof paperStoredKindSchema>

export const paperCreateInputSchema = z
  .object({
    kind: paperStoredKindSchema,
    templateId: paperTemplateIdSchema.optional(),
    name: paperDocNameSchema.optional(),
    jobId: jobIdSchema.optional(),
  })
  .strict()

export const paperReplaceInputSchema = z
  .object({
    docId: paperDocIdSchema,
    contentVersion: z.number().int().positive(),
    document: z.unknown(),
  })
  .strict()

export const paperRenameInputSchema = paperRenameDocInputSchema

export const paperDuplicateInputSchema = z
  .object({
    docId: paperDocIdSchema,
  })
  .strict()

export const paperDeleteInputSchema = paperDeleteDocInputSchema

export const paperSetTemplateInputSchema = z
  .object({
    docId: paperDocIdSchema,
    templateId: paperTemplateIdSchema,
  })
  .strict()

export const paperShareInputSchema = z
  .object({
    docId: paperDocIdSchema,
  })
  .strict()

export const paperUnshareInputSchema = paperShareInputSchema
export const paperDismissCheckInputSchema = z
  .object({
    docId: paperDocIdSchema,
    checkId: z.string().trim().min(1).max(80),
  })
  .strict()

export const paperKeepTwoPagesInputSchema = paperShareInputSchema

export const paperImportInputSchema = z
  .object({
    fileId: fileIdSchema,
  })
  .strict()

export const paperSetStatusCommandInputSchema = paperSetStatusInputSchema

export type PaperCreateInput = z.infer<typeof paperCreateInputSchema>
export type PaperReplaceInput = z.infer<typeof paperReplaceInputSchema>
export type PaperDuplicateInput = z.infer<typeof paperDuplicateInputSchema>
export type PaperSetTemplateInput = z.infer<typeof paperSetTemplateInputSchema>
export type PaperImportInput = z.infer<typeof paperImportInputSchema>
