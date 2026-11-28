import { z } from "zod"
import {
  inlineSchema,
  paragraphSchema,
  pageSchema,
  parse,
  refuse,
  type Result,
} from "./presentation-values.js"
import {
  catalogSchema,
  resolveStyles,
  resolveInline,
  resolveParagraph,
} from "./presentation-styles.js"

export const documentPresentationSchema = z
  .object({
    codecVersion: z.literal(1),
    page: pageSchema,
    inline: inlineSchema,
    paragraph: paragraphSchema,
    styles: catalogSchema,
  })
  .strict()
const snapshotSchema = z
  .object({
    document: documentPresentationSchema,
    blocks: z
      .array(
        z
          .object({
            ownerId: z.string().min(1).max(128),
            paragraph: paragraphSchema,
            runs: z
              .array(
                z
                  .object({
                    text: z.string().max(1000000),
                    values: inlineSchema,
                  })
                  .strict()
              )
              .max(10000),
          })
          .strict()
      )
      .max(10000),
  })
  .strict()
export type PresentationSnapshot = z.infer<typeof snapshotSchema>
export function checkSnapshot(input: unknown): Result<PresentationSnapshot> {
  const result = parse(snapshotSchema, input)
  if (result.kind === "refused") return result
  const s = result.value
  if (new Set(s.blocks.map((b) => b.ownerId)).size !== s.blocks.length)
    return refuse("Duplicate owner")
  const styles = resolveStyles(s.document.styles)
  if (styles.kind === "refused") return styles
  const inline = [
    s.document.inline,
    ...s.blocks.flatMap((b) => b.runs.map((r) => r.values)),
  ]
  const paragraphs = [s.document.paragraph, ...s.blocks.map((b) => b.paragraph)]
  for (const value of inline) {
    const { characterStyle, ...overrides } = value
    const resolved = resolveInline(
      styles.value,
      characterStyle ?? null,
      overrides
    )
    if (resolved.kind === "refused") return resolved
  }
  for (const value of paragraphs) {
    const { paragraphStyle, ...overrides } = value
    const resolved = resolveParagraph(
      styles.value,
      paragraphStyle ?? null,
      overrides
    )
    if (resolved.kind === "refused") return resolved
  }
  return result
}
export function isWellFormed(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(++i)
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false
    } else if (code >= 0xdc00 && code <= 0xdfff) return false
  }
  return true
}
