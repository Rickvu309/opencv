import { z } from "zod"

import { paperIdSchema } from "../ids.js"

export const LETTER_ATTACHMENT_TEXT_MAX = 6000

export const letterAttachmentContextSchema = z
  .object({
    name: z.string().min(1).max(200),
    text: z.string().trim().min(1).max(LETTER_ATTACHMENT_TEXT_MAX),
    truncated: z.boolean(),
  })
  .strict()

export type LetterAttachmentContext = z.infer<
  typeof letterAttachmentContextSchema
>

const PAPER_DOC_NAME_MAX = 200

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

const PAPER_DOC_NAME_FILE_EXTENSION = /\.(docx?|pdf|rtf|txt|odt)$/i

export const paperDocNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(PAPER_DOC_NAME_MAX, "Name is too long")
  .refine(
    (name) => !PAPER_DOC_NAME_FILE_EXTENSION.test(name),
    "Leave out the file extension"
  )

export type PaperContentKind = z.infer<typeof paperContentKindSchema>

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

export const paperPhotoValueSchema = z
  .string()
  .refine(
    (value) => !value.startsWith("blob:"),
    "Store a file id, not a browser blob URL."
  )

const PAPER_PHOTO_FILE_PREFIX = "file:"

export function paperPhotoRef(fileId: string) {
  return `${PAPER_PHOTO_FILE_PREFIX}${fileId}`
}

const PHOTO_FILE_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function paperPhotoFileId(value: string | null | undefined) {
  if (!value?.startsWith(PAPER_PHOTO_FILE_PREFIX)) return null
  const id = value.slice(PAPER_PHOTO_FILE_PREFIX.length)
  return PHOTO_FILE_ID.test(id) ? id : null
}

export const IMPORT_PAGES_MESSAGE =
  "Pages files aren't supported. Try a PDF or Word file."
export const IMPORT_GOOGLE_MESSAGE =
  "Google Docs aren't supported. Download a PDF or Word file."
export const IMPORT_LINKEDIN_MESSAGE =
  "LinkedIn links aren't supported. Download a PDF or Word file."

const proofViewModeSchema = z.enum(["chain", "timeline"])
const proofStepTypeSchema = z.enum(["context", "action", "outcome", "note"])

const proofPhotoSchema = z
  .object({
    id: z.string(),
    url: z.string(),
    caption: z.string().optional(),
  })
  .strict()

const proofStepSchema = z
  .object({
    id: z.string(),
    type: proofStepTypeSchema,
    title: z.string(),
    body: z.string(),
    time: z.string().optional(),
    date: z.string().optional(),
    photos: z.array(proofPhotoSchema),
  })
  .strict()

const proofDocumentSchema = z
  .object({
    viewMode: proofViewModeSchema,
    title: z.string(),
    subtitle: z.string().optional(),
    steps: z.array(proofStepSchema),
  })
  .strict()

export type ProofDocument = z.infer<typeof proofDocumentSchema>

export function isProofDocument(value: unknown): value is ProofDocument {
  return proofDocumentSchema.safeParse(value).success
}
