import { z } from "zod"

import { fileIdSchema, jobIdSchema, paperIdSchema } from "./ids.js"

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

export const PAPER_CONTENT_VERSION = 1
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

export const paperDocNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(PAPER_DOC_NAME_MAX, "Name is too long")

const paperRenameDocInputSchema = z
  .object({
    docId: paperDocIdSchema,
    name: paperDocNameSchema,
  })
  .strict()

const paperSetStatusInputSchema = z
  .object({
    docId: paperDocIdSchema,
    status: paperDocStatusSchema,
  })
  .strict()

const paperDeleteDocInputSchema = z
  .object({
    docId: paperDocIdSchema,
  })
  .strict()

export type PaperContentKind = z.infer<typeof paperContentKindSchema>
export type PaperDocStatus = z.infer<typeof paperDocStatusSchema>

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
    document: z.unknown().optional(),
    templateId: paperTemplateIdSchema.optional(),
    name: paperDocNameSchema.optional(),
    jobId: jobIdSchema.optional(),
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

export const paperKeywordGapInputSchema = z
  .object({
    docId: paperDocIdSchema,
    jobId: jobIdSchema,
  })
  .strict()

export const paperDeleteFileInputSchema = z
  .object({
    fileId: fileIdSchema,
  })
  .strict()

export const paperAttachPhotoInputSchema = z
  .object({
    docId: paperDocIdSchema,
    fileId: fileIdSchema.nullable(),
    quiet: z.boolean().optional(),
  })
  .strict()

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

const KEYWORD_STOP = new Set(["the", "and", "for", "with", "your"])

export function keywordGap(
  letterText: string,
  requirements: string
): { keyword: string; sentence: string } | null {
  const letter = letterText.toLowerCase()
  const runs = requirements.match(/[A-Z][\w+#]*(?: [A-Z][\w+#]*)*/g) ?? []
  for (const run of runs) {
    const words = run.split(" ")
    while (words.length > 0 && KEYWORD_STOP.has(words[0]!.toLowerCase()))
      words.shift()
    while (
      words.length > 0 &&
      KEYWORD_STOP.has(words[words.length - 1]!.toLowerCase())
    )
      words.pop()
    const phrase = words.join(" ")
    if (phrase.replace(/[^A-Za-z]/g, "").length < 3) continue
    if (letter.includes(phrase.toLowerCase())) continue
    return {
      keyword: phrase,
      sentence: `The job asks for ${phrase}. Add it if you've used it.`,
    }
  }
  return null
}
