import { z } from "zod"

import { idResult, type FileId } from "../ids.js"
import {
  alignSchema,
  blockIdSchema,
  blockSchema,
  hrefSchema,
  lineSpacingSchema,
  listKindSchema,
  markSchema,
  pageSetupSchema,
  positiveMptSchema,
  runSchema,
  templateIdSchema,
  textKindSchema,
} from "./engine-document.js"

const indexSchema = z.int().nonnegative()
const blockIdsSchema = z.array(blockIdSchema).min(1)

export const posSchema = z.strictObject({
  block: blockIdSchema,
  offset: indexSchema,
  cell: z.strictObject({ row: indexSchema, col: indexSchema }).optional(),
})

export const rangeSchema = z.strictObject({ from: posSchema, to: posSchema })

export const selectionSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("text"),
    anchor: posSchema,
    head: posSchema,
  }),
  z.strictObject({ kind: z.literal("block"), block: blockIdSchema }),
  z.strictObject({ kind: z.literal("all") }),
])

export const selectionCommandSchema = z.discriminatedUnion("op", [
  z.strictObject({ op: z.literal("select"), selection: selectionSchema }),
  z.strictObject({
    op: z.literal("move"),
    unit: z.enum(["char", "word", "line", "lineEdge", "block", "doc"]),
    dir: z.literal([-1, 1]),
    extend: z.boolean(),
  }),
  z.strictObject({ op: z.literal("selectWord") }),
  z.strictObject({ op: z.literal("selectBlock") }),
  z.strictObject({ op: z.literal("selectAll") }),
])

export const docCommandSchema = z.discriminatedUnion("op", [
  z.strictObject({
    op: z.literal("insertText"),
    range: rangeSchema,
    text: z.string(),
    expect: z.string().optional(),
  }),
  z.strictObject({
    op: z.literal("deleteRange"),
    range: rangeSchema,
    expect: z.string().optional(),
  }),
  z.strictObject({ op: z.literal("splitBlock"), at: posSchema }),
  z.strictObject({
    op: z.literal("joinBlocks"),
    block: blockIdSchema,
    direction: z.enum(["backward", "forward"]),
  }),
  z.strictObject({
    op: z.literal("setBlockKind"),
    blocks: blockIdsSchema,
    kind: textKindSchema,
  }),
  z.strictObject({
    op: z.literal("setList"),
    blocks: blockIdsSchema,
    list: listKindSchema.nullable(),
  }),
  z.strictObject({
    op: z.literal("shiftLevel"),
    blocks: blockIdsSchema,
    by: z.literal([-1, 1]),
  }),
  z.strictObject({
    op: z.literal("setAlign"),
    blocks: blockIdsSchema,
    align: alignSchema,
  }),
  z.strictObject({
    op: z.literal("setLineSpacing"),
    blocks: blockIdsSchema,
    lineSpacing: lineSpacingSchema,
  }),
  z.strictObject({
    op: z.literal("setRightTab"),
    blocks: blockIdsSchema,
    rightTabMpt: positiveMptSchema.nullable(),
  }),
  z.strictObject({
    op: z.literal("setMark"),
    range: rangeSchema,
    mark: markSchema,
    on: z.boolean(),
  }),
  z.strictObject({ op: z.literal("clearFormatting"), range: rangeSchema }),
  z.strictObject({
    op: z.literal("setLink"),
    range: rangeSchema,
    href: hrefSchema.nullable(),
    text: z.string().optional(),
  }),
  z.strictObject({
    op: z.literal("insertImage"),
    at: posSchema,
    fileId: idResult<FileId>(),
    widthMpt: positiveMptSchema,
    heightMpt: positiveMptSchema,
  }),
  z.strictObject({
    op: z.literal("setImage"),
    block: blockIdSchema,
    widthMpt: positiveMptSchema.optional(),
    heightMpt: positiveMptSchema.optional(),
    align: alignSchema.optional(),
    alt: z.string().optional(),
  }),
  z.strictObject({
    op: z.literal("insertTable"),
    at: posSchema,
    rows: z.int().positive(),
    cols: z.int().positive(),
  }),
  z.strictObject({
    op: z.literal("editTable"),
    block: blockIdSchema,
    row: indexSchema,
    col: indexSchema,
    action: z.enum([
      "rowAbove",
      "rowBelow",
      "deleteRow",
      "colLeft",
      "colRight",
      "deleteCol",
      "deleteTable",
    ]),
  }),
  z.strictObject({
    op: z.literal("insertBlock"),
    at: posSchema,
    block: z.enum(["divider", "page_break"]),
  }),
  z.strictObject({ op: z.literal("deleteBlock"), block: blockIdSchema }),
  z.strictObject({
    op: z.literal("pasteFragment"),
    range: rangeSchema,
    fragment: z.union([z.array(blockSchema), z.array(runSchema)]),
  }),
  z.strictObject({
    op: z.literal("replaceAll"),
    find: z.string().min(1),
    replace: z.string(),
    matchCase: z.boolean(),
  }),
  z.strictObject({ op: z.literal("setPageSetup"), page: pageSetupSchema }),
  z.strictObject({ op: z.literal("setTemplate"), template: templateIdSchema }),
])

const expectedBlocksSchema = z.strictObject({
  blocks: blockIdsSchema,
  expect: z.array(z.string()),
})

export const agentCommandSchema = z
  .discriminatedUnion("op", [
    z.strictObject({
      op: z.literal("replaceText"),
      range: rangeSchema,
      expect: z.string(),
      text: z.string(),
    }),
    z.strictObject({
      op: z.literal("formatText"),
      range: rangeSchema,
      expect: z.string(),
      mark: z.enum(["bold", "italic", "underline"]),
      on: z.boolean(),
    }),
    z.strictObject({
      op: z.literal("insertBlocks"),
      after: blockIdSchema,
      expect: z.string(),
      blocks: z
        .array(
          z.strictObject({
            kind: textKindSchema,
            content: z.array(runSchema).optional(),
          })
        )
        .min(1),
    }),
    expectedBlocksSchema.extend({ op: z.literal("removeBlocks") }),
    expectedBlocksSchema.extend({
      op: z.literal("setBlockType"),
      kind: textKindSchema,
    }),
  ])
  .refine(
    (command) => {
      if (command.op === "removeBlocks" || command.op === "setBlockType") {
        return command.expect.length === command.blocks.length
      }
      return true
    },
    {
      path: ["expect"],
      message: "Supply expected text for each block in order",
    }
  )

export type Pos = z.infer<typeof posSchema>
export type Range = z.infer<typeof rangeSchema>
export type Selection = z.infer<typeof selectionSchema>
export type SelectionCommand = z.infer<typeof selectionCommandSchema>
export type DocCommand = z.infer<typeof docCommandSchema>
export type AgentCommand = z.infer<typeof agentCommandSchema>
