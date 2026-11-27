import { z } from "zod"

import { idResult, type FileId } from "../ids.js"
import { blockIdSchema } from "./engine-document.js"

export const layoutRectSchema = z.strictObject({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
})

const layoutCellRefSchema = z.strictObject({
  row: z.int().nonnegative(),
  col: z.int().nonnegative(),
})

export const layoutSegmentSchema = z.strictObject({
  x: z.number(),
  w: z.number(),
  text: z.string(),
  from: z.int().nonnegative(),
  font: z.string(),
  sizeMpt: z.number(),
  color: z.string(),
  underline: z.boolean(),
  strike: z.boolean(),
  href: z.string().nullable(),
})

export const layoutMarkerSchema = z.strictObject({
  text: z.string(),
  x: z.number(),
  font: z.string(),
  sizeMpt: z.number(),
})

const layoutLineBoxSchema = z.strictObject({
  kind: z.literal("line"),
  block: blockIdSchema,
  cell: layoutCellRefSchema.optional(),
  rect: layoutRectSchema,
  baseline: z.number(),
  from: z.int().nonnegative(),
  to: z.int().nonnegative(),
  marker: layoutMarkerSchema.nullable(),
  segments: z.array(layoutSegmentSchema),
})

export const layoutBoxSchema = z.discriminatedUnion("kind", [
  layoutLineBoxSchema,
  z.strictObject({
    kind: z.literal("image"),
    block: blockIdSchema,
    rect: layoutRectSchema,
    fileId: idResult<FileId>(),
  }),
  z.strictObject({
    kind: z.literal("rule"),
    block: blockIdSchema,
    rect: layoutRectSchema,
  }),
  z.strictObject({
    kind: z.literal("break"),
    block: blockIdSchema,
    rect: layoutRectSchema,
  }),
  z.strictObject({
    kind: z.literal("cell"),
    block: blockIdSchema,
    row: z.int().nonnegative(),
    col: z.int().nonnegative(),
    rect: layoutRectSchema,
    borders: z.enum(["none", "all"]),
  }),
])

export const layoutPageSchema = z.strictObject({
  index: z.int().nonnegative(),
  size: z.strictObject({ w: z.number(), h: z.number() }),
  content: layoutRectSchema,
  boxes: z.array(layoutBoxSchema),
})

export type LayoutRect = z.output<typeof layoutRectSchema>
export type LayoutSegment = z.output<typeof layoutSegmentSchema>
export type LayoutMarker = z.output<typeof layoutMarkerSchema>
export type LayoutBox = z.output<typeof layoutBoxSchema>
export type LayoutPage = z.output<typeof layoutPageSchema>
