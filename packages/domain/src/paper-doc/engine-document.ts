import { z } from "zod"

import { idResult, type FileId } from "../ids.js"
import { isSafeHref } from "./rich-text.js"

export const blockIdSchema = z.string().min(1).brand<"BlockId">()
export const positiveMptSchema = z.int().positive()
export const alignSchema = z.enum(["left", "center", "right", "justify"])
export const textKindSchema = z.enum([
  "title",
  "subtitle",
  "heading",
  "subheading",
  "paragraph",
])
export const listKindSchema = z.enum(["bullet", "numbered"])
export const lineSpacingSchema = z.number().positive().nullable()
export const templateIdSchema = z.enum(["classic", "modern", "letter"])
const fontFamilySchema = z.enum([
  "Liberation Sans",
  "Liberation Serif",
  "Liberation Mono",
  "Carlito",
])

const marginMptSchema = z.int().nonnegative()

export const pageSetupSchema = z.strictObject({
  size: z.enum(["A4", "Letter"]),
  orientation: z.enum(["portrait", "landscape"]),
  marginsMpt: z.strictObject({
    top: marginMptSchema,
    right: marginMptSchema,
    bottom: marginMptSchema,
    left: marginMptSchema,
  }),
})

export type PageSetup = z.infer<typeof pageSetupSchema>
export type BlockId = z.infer<typeof blockIdSchema>

export const hrefSchema = z
  .string()
  .refine(isSafeHref, "Only http, https and mailto links are allowed")

const markSchemas = [
  z.strictObject({ type: z.literal("bold") }),
  z.strictObject({ type: z.literal("italic") }),
  z.strictObject({ type: z.literal("underline") }),
  z.strictObject({ type: z.literal("strike") }),
  z.strictObject({
    type: z.literal("link"),
    attrs: z.strictObject({ href: hrefSchema }),
  }),
  z.strictObject({
    type: z.literal("color"),
    attrs: z.strictObject({ value: z.string().regex(/^#[0-9a-f]{6}$/i) }),
  }),
  z.strictObject({
    type: z.literal("font"),
    attrs: z.strictObject({ family: fontFamilySchema }),
  }),
  z.strictObject({
    type: z.literal("size"),
    attrs: z.strictObject({ mpt: positiveMptSchema }),
  }),
] as const

export const markSchema = z.discriminatedUnion("type", markSchemas)
export type Mark = z.infer<typeof markSchema>

const markOrder = markSchemas.map((schema) => schema.shape.type.value)
const orderedMarksSchema = z.array(markSchema).refine(
  (marks) =>
    marks.every((mark, index) => {
      const previous = marks[index - 1]
      return (
        !previous ||
        markOrder.indexOf(previous.type) < markOrder.indexOf(mark.type)
      )
    }),
  "Marks must be unique and appear in schema order"
)

export const runSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("text"),
    text: z.string().min(1),
    marks: orderedMarksSchema.optional(),
  }),
  z.strictObject({ type: z.literal("hard_break") }),
])

export type Run = z.infer<typeof runSchema>

const runsSchema = z.array(runSchema).optional()
const blockIdentitySchema = z.strictObject({ id: blockIdSchema })

const textBlockSchema = z.strictObject({
  type: z.literal("text_block"),
  attrs: blockIdentitySchema
    .extend({
      kind: textKindSchema,
      list: listKindSchema.nullable(),
      level: z.literal([0, 1, 2, 3, 4, 5, 6, 7, 8]),
      align: alignSchema,
      lineSpacing: lineSpacingSchema,
      keepWithNext: z.boolean().nullable(),
      rightTabMpt: positiveMptSchema.optional(),
    })
    .refine(({ list, level }) => list !== null || level === 0, {
      path: ["level"],
      message: "Only list items can have a level above zero",
    }),
  content: runsSchema,
})

const imageBlockSchema = z.strictObject({
  type: z.literal("image"),
  attrs: blockIdentitySchema.extend({
    fileId: idResult<FileId>(),
    widthMpt: positiveMptSchema,
    heightMpt: positiveMptSchema,
    align: alignSchema,
    alt: z.string(),
  }),
})

const tableCellSchema = z.strictObject({
  type: z.literal("table_cell"),
  content: runsSchema,
})

const tableRowSchema = z.strictObject({
  type: z.literal("table_row"),
  content: z.array(tableCellSchema).min(1),
})

const tableBlockSchema = z
  .strictObject({
    type: z.literal("table"),
    attrs: blockIdentitySchema.extend({
      columnsMpt: z.array(positiveMptSchema).min(1),
      borders: z.enum(["none", "all"]),
    }),
    content: z.array(tableRowSchema).min(1),
  })
  .refine(
    ({ attrs, content }) =>
      content.every((row) => row.content.length === attrs.columnsMpt.length),
    {
      path: ["content"],
      message: "Every table row must match its column count",
    }
  )

export const blockSchema = z.discriminatedUnion("type", [
  textBlockSchema,
  imageBlockSchema,
  tableBlockSchema,
  z.strictObject({ type: z.literal("divider"), attrs: blockIdentitySchema }),
  z.strictObject({ type: z.literal("page_break"), attrs: blockIdentitySchema }),
])

export const documentSchema = z
  .strictObject({
    type: z.literal("doc"),
    attrs: z.strictObject({
      schema: z.literal(1),
      page: pageSetupSchema,
      template: templateIdSchema,
    }),
    content: z.array(blockSchema).min(1),
  })
  .refine(
    ({ content }) =>
      new Set(content.map((block) => block.attrs.id)).size === content.length,
    { path: ["content"], message: "Block ids must be unique" }
  )

export type Block = z.infer<typeof blockSchema>
export type Document = z.infer<typeof documentSchema>
