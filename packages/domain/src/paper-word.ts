import { z } from "zod"

declare const TextEncoder: {
  new (): { encode(value: string): Uint8Array }
}

export const WORD_LIMITS = Object.freeze({
  maxOpsPerApply: 100,
  maxOpsPerConfirmedEdit: 20,
  maxTextBytes: 8 * 1024,
  maxBatchTextBytes: 64 * 1024,
  maxEncodedBatchBytes: 96 * 1024,
  maxImportUploadBytes: 8 * 1024 * 1024,
  maxInflatedPackageBytes: 64 * 1024 * 1024,
})

export const PAPER_WORD_LIMITS = WORD_LIMITS

export const WORD_DOCUMENT_MEDIA_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document" as const

export const wordOwnerSchema = z.string().min(1)
export const wordDocSchema = z.string().uuid()
export const wordRevisionSchema = z.string().uuid()
export const wordHandleSchema = z.string().uuid()

function hasControlCode(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code < 32 || code === 127) return true
  }
  return false
}

const wordTextSchema = z
  .string()
  .refine(
    (value) => !hasControlCode(value),
    "Text must not contain control characters or newlines."
  )
  .refine(
    (value) =>
      new TextEncoder().encode(value).byteLength <= WORD_LIMITS.maxTextBytes,
    "Text exceeds maximum size of 8 KiB."
  )

export const wordSetTextOpSchema = z
  .object({
    op: z.literal("setText"),
    handle: wordHandleSchema,
    text: wordTextSchema,
  })
  .strict()

export const wordInsertOpSchema = z
  .object({
    op: z.literal("insert"),
    after: wordHandleSchema.nullable(),
    text: wordTextSchema,
  })
  .strict()

export const wordDeleteOpSchema = z
  .object({
    op: z.literal("delete"),
    handle: wordHandleSchema,
  })
  .strict()

export const wordOpSchema = z.discriminatedUnion("op", [
  wordSetTextOpSchema,
  wordInsertOpSchema,
  wordDeleteOpSchema,
])

export const wordBatchSchema = z
  .object({
    doc: wordDocSchema,
    basedOn: wordRevisionSchema,
    ops: z.array(wordOpSchema).min(1).max(WORD_LIMITS.maxOpsPerApply),
  })
  .strict()
  .refine((batch) => {
    let total = 0
    for (const op of batch.ops) {
      if ("text" in op) {
        total += new TextEncoder().encode(op.text).byteLength
      }
    }
    return total <= WORD_LIMITS.maxBatchTextBytes
  }, "Total text bytes in batch exceed limit of 64 KiB.")

export const wordConfirmedEditOpsSchema = z
  .array(wordOpSchema)
  .min(1)
  .max(WORD_LIMITS.maxOpsPerConfirmedEdit)

export const wordPieceSchema = z
  .object({
    text: z.string(),
    editable: z.boolean(),
  })
  .strict()

export const wordParagraphSchema = z
  .object({
    handle: wordHandleSchema,
    text: z.string(),
    pieces: z.array(wordPieceSchema),
    held: z.boolean(),
    message: z.string(),
    code: z.string().nullable(),
  })
  .strict()

export const wordPageLabelSchema = z.enum(["cv", "letter"])

export const wordPageSchema = z
  .object({
    doc: wordDocSchema,
    revision: wordRevisionSchema,
    name: z.string(),
    label: wordPageLabelSchema,
    paragraphs: z.array(wordParagraphSchema),
  })
  .strict()

export const wordReasonSchema = z.enum([
  "stale",
  "held",
  "plain",
  "limit",
  "order",
  "closed",
  "missing",
  "foreign",
])

export const wordRefusalSchema = z
  .object({
    refused: z.literal(true),
    reason: wordReasonSchema,
    message: z.string(),
    code: z.string().nullable(),
    handle: wordHandleSchema.nullable(),
  })
  .strict()

export const wordUndoSchema = z
  .object({
    doc: wordDocSchema,
    revision: wordRevisionSchema,
    restore: wordRevisionSchema,
  })
  .strict()

export const wordCommitSchema = z
  .object({
    refused: z.literal(false),
    page: wordPageSchema,
    undo: wordUndoSchema.nullable(),
  })
  .strict()

export const wordFileSchema = z
  .object({
    bytes: z.instanceof(Uint8Array),
    mediaType: z.literal(WORD_DOCUMENT_MEDIA_TYPE),
    revision: wordRevisionSchema,
  })
  .strict()

export const wordSourceReadSchema = z
  .object({
    kind: z.literal("read"),
    doc: wordDocSchema,
    at: wordRevisionSchema.optional(),
  })
  .strict()

export const wordSourceMintSchema = z
  .object({
    kind: z.literal("mint"),
    name: z.string(),
    label: wordPageLabelSchema,
  })
  .strict()

export const wordSourceImportSchema = z
  .object({
    kind: z.literal("import"),
    name: z.string(),
    label: wordPageLabelSchema,
    bytes: z.instanceof(Uint8Array),
  })
  .strict()

export const wordSourceSchema = z.discriminatedUnion("kind", [
  wordSourceReadSchema,
  wordSourceMintSchema,
  wordSourceImportSchema,
])

export type WordOwner = z.infer<typeof wordOwnerSchema>
export type WordDoc = z.infer<typeof wordDocSchema>
export type WordRevision = z.infer<typeof wordRevisionSchema>
export type WordHandle = z.infer<typeof wordHandleSchema>
export type WordSetTextOp = z.infer<typeof wordSetTextOpSchema>
export type WordInsertOp = z.infer<typeof wordInsertOpSchema>
export type WordDeleteOp = z.infer<typeof wordDeleteOpSchema>
export type WordOp = z.infer<typeof wordOpSchema>
export type WordBatch = z.infer<typeof wordBatchSchema>
export type WordPiece = z.infer<typeof wordPieceSchema>
export type WordParagraph = z.infer<typeof wordParagraphSchema>
export type WordPageLabel = z.infer<typeof wordPageLabelSchema>
export type WordPage = z.infer<typeof wordPageSchema>
export type WordReason = z.infer<typeof wordReasonSchema>
export type WordRefusal = z.infer<typeof wordRefusalSchema>
export type WordUndo = z.infer<typeof wordUndoSchema>
export type WordCommit = z.infer<typeof wordCommitSchema>
export type WordFile = z.infer<typeof wordFileSchema>
export type WordSource = z.infer<typeof wordSourceSchema>
