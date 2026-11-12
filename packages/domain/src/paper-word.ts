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

export const WORD_DOCUMENT_MEDIA_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document" as const

const wordDocSchema = z.string().uuid()
const wordRevisionSchema = z.string().uuid()
const wordHandleSchema = z.string().uuid()

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

const wordSetTextOpSchema = z
  .object({
    op: z.literal("setText"),
    handle: wordHandleSchema,
    text: wordTextSchema,
    caret: z.number().int().nonnegative().optional(),
  })
  .strict()

const wordInsertOpSchema = z
  .object({
    op: z.literal("insert"),
    after: wordHandleSchema.nullable(),
    text: wordTextSchema,
  })
  .strict()

const wordDeleteOpSchema = z
  .object({
    op: z.literal("delete"),
    handle: wordHandleSchema,
  })
  .strict()

const wordOpSchema = z.discriminatedUnion("op", [
  wordSetTextOpSchema,
  wordInsertOpSchema,
  wordDeleteOpSchema,
])

export const wordConfirmedOpsSchema = z
  .array(wordOpSchema)
  .min(1)
  .max(WORD_LIMITS.maxOpsPerConfirmedEdit)

export const wordReviewSchema = z
  .object({
    docId: wordDocSchema,
    basedOn: wordRevisionSchema,
    operations: z
      .array(
        z
          .object({
            op: z.enum(["setText", "insert", "delete"]),
            before: z.string(),
            after: z.string(),
            place: z.string().nullable().optional(),
          })
          .strict()
      )
      .min(1)
      .max(WORD_LIMITS.maxOpsPerConfirmedEdit),
  })
  .strict()

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

const wordPageLabelSchema = z.enum(["cv", "letter"])

export const wordUndoSchema = z
  .object({
    doc: wordDocSchema,
    revision: wordRevisionSchema,
    restore: wordRevisionSchema,
  })
  .strict()

const wordSourceReadSchema = z
  .object({
    kind: z.literal("read"),
    doc: wordDocSchema,
    at: wordRevisionSchema.optional(),
  })
  .strict()

const wordSourceMintSchema = z
  .object({
    kind: z.literal("mint"),
    name: z.string(),
    label: wordPageLabelSchema,
  })
  .strict()

export const wordSourceSchema = z.discriminatedUnion("kind", [
  wordSourceReadSchema,
  wordSourceMintSchema,
])

const wordMarkSchema = z.enum(["bold", "italic", "underline", "link"])

const wordListLevelSchema = z.number().int().min(0).max(8)

const wordFormSchema = z.union([
  z
    .object({ kind: z.literal("title") })
    .strict()
    .readonly(),
  z
    .object({
      kind: z.literal("heading"),
      level: z.number().int().min(1).max(6),
    })
    .strict()
    .readonly(),
  z
    .object({ kind: z.literal("bullet"), level: wordListLevelSchema })
    .strict()
    .readonly(),
  z
    .object({ kind: z.literal("number"), level: wordListLevelSchema })
    .strict()
    .readonly(),
])

const wordAlignSchema = z.enum(["center", "end", "justify"])

const wordParagraphSchema = z
  .object({
    handle: wordHandleSchema,
    text: z.string(),
    pieces: z
      .array(
        z
          .object({
            text: z.string(),
            editable: z.boolean(),
            marks: z.array(wordMarkSchema).min(1).readonly().optional(),
          })
          .strict()
          .readonly()
      )
      .readonly(),
    held: z.boolean(),
    message: z.string(),
    code: z.string().nullable(),
    form: wordFormSchema.optional(),
    align: wordAlignSchema.optional(),
  })
  .strict()
  .readonly()

export const wordPageSchema = z
  .object({
    doc: wordDocSchema,
    revision: wordRevisionSchema,
    name: z.string(),
    label: wordPageLabelSchema,
    paragraphs: z.array(wordParagraphSchema).readonly(),
  })
  .strict()
  .readonly()

export type WordDoc = z.infer<typeof wordDocSchema>
export type WordRevision = z.infer<typeof wordRevisionSchema>
export type WordHandle = z.infer<typeof wordHandleSchema>
export type WordOp = z.infer<typeof wordOpSchema>
export type WordBatch = z.infer<typeof wordBatchSchema>
export type WordUndo = z.infer<typeof wordUndoSchema>
export type WordSource = z.infer<typeof wordSourceSchema>

export type WordOwner = string

export type WordParagraph = z.infer<typeof wordParagraphSchema>

export type WordMark = z.infer<typeof wordMarkSchema>

export type WordForm = z.infer<typeof wordFormSchema>

export type WordAlign = z.infer<typeof wordAlignSchema>

export type WordPage = z.infer<typeof wordPageSchema>

export type WordReason =
  | "stale"
  | "held"
  | "plain"
  | "limit"
  | "order"
  | "closed"
  | "missing"
  | "foreign"

export type WordRefusal = {
  readonly refused: true
  readonly reason: WordReason
  readonly message: string
  readonly code: string | null
  readonly handle: WordHandle | null
}

export type WordCommit = {
  readonly refused: false
  readonly page: WordPage
  readonly undo: WordUndo | null
}

export type WordFile = {
  readonly bytes: Uint8Array
  readonly mediaType: typeof WORD_DOCUMENT_MEDIA_TYPE
  readonly revision: WordRevision
}
