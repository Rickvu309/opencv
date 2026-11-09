import { z } from "zod"

declare const TextEncoder: {
  new (): { encode(value: string): Uint8Array }
}

const TARGET = /^t_[a-f0-9]{64}$/
const TEXT_BYTES = 8 * 1024
const REPLACEMENT_CAP = 20

function refuse(): never {
  throw new Error("This Word review is unavailable.")
}

function textBytes(value: string) {
  return new TextEncoder().encode(value).byteLength
}

export const paperReviewReplacementSchema = z
  .object({
    target: z.string().regex(TARGET),
    before: z
      .string()
      .min(1)
      .refine((value) => textBytes(value) <= TEXT_BYTES),
    after: z.string().refine((value) => textBytes(value) <= TEXT_BYTES),
  })
  .strict()

export type PaperReviewReplacement = Readonly<
  z.infer<typeof paperReviewReplacementSchema>
>

export type PaperReviewDiff = readonly PaperReviewReplacement[]

function recordOf(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return null
  const record = value as Record<string, unknown>
  return record
}

function replacementOf(value: unknown): PaperReviewReplacement {
  const change = recordOf(value)
  if (
    !change ||
    !Object.hasOwn(change, "targetId") ||
    !Object.hasOwn(change, "before") ||
    !Object.hasOwn(change, "after")
  )
    refuse()
  const parsed = paperReviewReplacementSchema.safeParse({
    target: change.targetId,
    before: change.before,
    after: change.after,
  })
  if (!parsed.success) refuse()
  return Object.freeze(parsed.data)
}

export function paperReviewDiff(review: unknown): PaperReviewDiff {
  const record = recordOf(review)
  if (!record || !Object.hasOwn(record, "changes")) refuse()
  const changes = record.changes
  if (!Array.isArray(changes) || changes.length > REPLACEMENT_CAP) refuse()
  const seen = new Set<string>()
  const replacements = changes.map((change) => {
    const replacement = replacementOf(change)
    if (seen.has(replacement.target)) refuse()
    seen.add(replacement.target)
    return replacement
  })
  return Object.freeze(replacements)
}
