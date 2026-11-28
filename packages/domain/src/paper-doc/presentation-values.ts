import { z } from "zod"

export type Result<T> =
  { kind: "ok"; value: T } | { kind: "refused"; reason: string }
export const ok = <T>(value: T): Result<T> => ({ kind: "ok", value })
export const refuse = (reason: string): Result<never> => ({
  kind: "refused",
  reason,
})
export function parse<T>(schema: z.ZodType<T>, value: unknown): Result<T> {
  const result = schema.safeParse(value)
  return result.success ? ok(result.data) : refuse(result.error.message)
}
const twipsSchema = z.number().int().min(0).max(31680).brand<"Twips">()
export const fontIdSchema = z
  .enum(["liberation-sans", "liberation-serif", "liberation-mono"])
  .brand<"FontId">()
export const styleIdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]{0,63}$/)
  .brand<"StyleId">()
export type StyleId = z.infer<typeof styleIdSchema>
const color = z.string().regex(/^#[0-9A-F]{6}$/)
export const inlineSchema = z
  .object({
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    underline: z.boolean().optional(),
    strike: z.boolean().optional(),
    color: color.optional(),
    highlight: color.optional(),
    fontId: fontIdSchema.optional(),
    size: twipsSchema.refine((v) => v >= 80 && v <= 2880).optional(),
    characterStyle: styleIdSchema.optional(),
  })
  .strict()
export type InlinePresentation = z.infer<typeof inlineSchema>
const lineSpacingSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("multiple"),
      value: z.number().min(0.5).max(10),
    })
    .strict(),
  z
    .object({
      kind: z.literal("exact"),
      value: twipsSchema.refine((v) => v >= 20),
    })
    .strict(),
  z
    .object({
      kind: z.literal("atleast"),
      value: twipsSchema.refine((v) => v >= 20),
    })
    .strict(),
])
export const paragraphSchema = z
  .object({
    alignment: z.enum(["left", "center", "right", "justify"]).optional(),
    lineSpacing: lineSpacingSchema.optional(),
    before: twipsSchema.optional(),
    after: twipsSchema.optional(),
    start: twipsSchema.optional(),
    end: twipsSchema.optional(),
    indent: z
      .discriminatedUnion("kind", [
        z.object({ kind: z.literal("firstline"), value: twipsSchema }).strict(),
        z.object({ kind: z.literal("hanging"), value: twipsSchema }).strict(),
      ])
      .optional(),
    keepNext: z.boolean().optional(),
    keepTogether: z.boolean().optional(),
    widowOrphan: z.boolean().optional(),
    paragraphStyle: styleIdSchema.optional(),
  })
  .strict()
export type ParagraphPresentation = z.infer<typeof paragraphSchema>
const pagePropertiesSchema = z
  .object({
    width: twipsSchema.refine((v) => v >= 1440),
    height: twipsSchema.refine((v) => v >= 1440),
    orientation: z.enum(["portrait", "landscape"]),
    top: twipsSchema,
    bottom: twipsSchema,
    start: twipsSchema,
    end: twipsSchema,
  })
  .strict()
export const pageSchema = pagePropertiesSchema.superRefine((p, ctx) => {
  if (p.start + p.end >= p.width || p.top + p.bottom >= p.height)
    ctx.addIssue({ code: "custom", message: "Margins consume the page" })
  if (p.orientation === "portrait" ? p.width > p.height : p.width < p.height)
    ctx.addIssue({
      code: "custom",
      message: "Orientation disagrees with dimensions",
    })
})
export const inlinePatchSchema = inlineSchema
  .extend({
    bold: z.boolean().nullable().optional(),
    italic: z.boolean().nullable().optional(),
    underline: z.boolean().nullable().optional(),
    strike: z.boolean().nullable().optional(),
    color: color.nullable().optional(),
    highlight: color.nullable().optional(),
    fontId: fontIdSchema.nullable().optional(),
    size: inlineSchema.shape.size.unwrap().nullable().optional(),
    characterStyle: styleIdSchema.nullable().optional(),
  })
  .strict()
export const paragraphPatchSchema = z
  .object({
    alignment: paragraphSchema.shape.alignment.unwrap().nullable().optional(),
    lineSpacing: lineSpacingSchema.nullable().optional(),
    before: twipsSchema.nullable().optional(),
    after: twipsSchema.nullable().optional(),
    start: twipsSchema.nullable().optional(),
    end: twipsSchema.nullable().optional(),
    indent: paragraphSchema.shape.indent.unwrap().nullable().optional(),
    keepNext: z.boolean().nullable().optional(),
    keepTogether: z.boolean().nullable().optional(),
    widowOrphan: z.boolean().nullable().optional(),
    paragraphStyle: styleIdSchema.nullable().optional(),
  })
  .strict()
export function canonical(value: unknown): string {
  return (
    JSON.stringify(value, (_key, v: unknown) =>
      v !== null && typeof v === "object" && !Array.isArray(v)
        ? Object.fromEntries(
            Object.entries(v).sort(([a], [b]) => a.localeCompare(b, "en"))
          )
        : v
    ) ?? "undefined"
  )
}
export function overlay(base: object, patch: object): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete result[key]
    else if (value !== undefined) result[key] = value
  }
  return result
}
