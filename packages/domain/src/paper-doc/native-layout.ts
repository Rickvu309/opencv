import { z } from "zod"
import { tableBordersSchema } from "./table-borders.js"
import { paperTableLimits } from "../limits/paper-table.js"
import {
  layoutPhotoSchema,
  photoBounds,
  type LayoutPhoto,
} from "./native-photo.js"
import { nodeIdSchema } from "./nodes.js"
import {
  formatBodySchema,
  formatOwnerSchema,
  formattedDocumentSchema,
  mergeFormatRuns,
  type FormatNode,
} from "./native-formatting.js"
import { documentPresentationSchema } from "./presentation-edit.js"

const layoutColumnSchema = z
  .object({
    id: nodeIdSchema,
    width: z.number().int().min(480).max(31680),
  })
  .strict()
const layoutCellSchema = z
  .object({
    id: nodeIdSchema,
    type: z.literal("cell"),
    columnId: nodeIdSchema,
    children: z.array(formatBodySchema).min(1).max(1000),
  })
  .strict()
const layoutRowSchema = z
  .object({
    id: nodeIdSchema,
    type: z.literal("row"),
    children: z.array(layoutCellSchema).min(1).max(paperTableLimits.columns),
  })
  .strict()
export const layoutTableSchema = z
  .object({
    id: nodeIdSchema,
    type: z.literal("table"),
    borders: tableBordersSchema.optional(),
    columns: z.array(layoutColumnSchema).min(1).max(paperTableLimits.columns),
    children: z.array(layoutRowSchema).min(1).max(paperTableLimits.rows),
  })
  .strict()
  .superRefine((table, ctx) => {
    const columns = table.columns.map((c) => c.id)
    if (new Set(columns).size !== columns.length)
      ctx.addIssue({ code: "custom", message: "Duplicate column identity" })
    for (const row of table.children)
      if (
        row.children.length !== columns.length ||
        row.children.some((cell, i) => cell.columnId !== columns[i])
      )
        ctx.addIssue({ code: "custom", message: "Table must be rectangular" })
  })
export type LayoutTable =
  z.infer<typeof layoutTableSchema> | z.infer<typeof photoLayoutTableSchema>
export type LayoutRow =
  z.infer<typeof layoutRowSchema> | z.infer<typeof photoLayoutRowSchema>
export type LayoutCell =
  z.infer<typeof layoutCellSchema> | z.infer<typeof photoLayoutCellSchema>
export const privateLayoutSchema = z
  .object({
    profile: z.literal("private-layout-1"),
    kind: z.enum(["cv", "letter"]),
    presentation: documentPresentationSchema,
    flow: z
      .object({
        id: nodeIdSchema,
        type: z.literal("flow"),
        children: z
          .array(
            z.union([layoutTableSchema, formatOwnerSchema, formatBodySchema])
          )
          .min(1)
          .max(10000),
      })
      .strict(),
  })
  .strict()
  .superRefine((doc, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message })
    const ids = new Set<string>()
    let count = 0
    const identify = (id: string) => {
      count++
      if (ids.has(id)) fail("Duplicate layout identity")
      ids.add(id)
    }
    const visit = (
      node: FormatNode | LayoutPhoto | LayoutTable | LayoutRow | LayoutCell
    ) => {
      identify(node.id)
      if (node.type === "table") {
        node.columns.forEach((column) => identify(column.id))
        const page = doc.presentation.page
        if (
          node.columns.reduce((sum, column) => sum + column.width, 0) >
          page.width - page.start - page.end
        )
          fail("Table exceeds the page content width")
      }
      if ("children" in node) node.children.forEach(visit)
    }
    identify(doc.flow.id)
    doc.flow.children.forEach(visit)
    if (count > 10000) fail("Too many layout nodes")
    const outer = doc.flow.children.filter((node) => node.type !== "table")
    const semantic = formattedDocumentSchema.safeParse({
      profile: "private-formatting-1",
      kind: doc.kind,
      presentation: doc.presentation,
      ...(doc.kind === "cv"
        ? { header: outer[0], blocks: outer.slice(1) }
        : { blocks: outer }),
    })
    if (!semantic.success) fail(semantic.error.message)
    if (doc.kind === "cv" && doc.flow.children[0]?.type !== "header")
      fail("The CV header must begin the flow")
    const body = doc.flow.children.flatMap((node) =>
      node.type === "table"
        ? node.children.flatMap((row) =>
            row.children.flatMap((cell) => cell.children)
          )
        : []
    )
    const cells = formattedDocumentSchema.safeParse({
      profile: "private-formatting-1",
      kind: "letter",
      presentation: doc.presentation,
      blocks: body,
    })
    if (!cells.success) fail(cells.error.message)
  })
  .transform((doc) => {
    const visit = (
      node: FormatNode | LayoutPhoto | LayoutTable | LayoutRow | LayoutCell
    ) => {
      if ("content" in node) node.content = mergeFormatRuns(node.content)
      if ("children" in node) node.children.forEach(visit)
    }
    doc.flow.children.forEach(visit)
    return doc
  })

export const photoLayoutCellSchema = layoutCellSchema.extend({
  children: z
    .array(z.union([formatBodySchema, layoutPhotoSchema]))
    .min(1)
    .max(1000),
})
export const photoLayoutRowSchema = layoutRowSchema.extend({
  children: z.array(photoLayoutCellSchema).min(1).max(paperTableLimits.columns),
})
export const photoLayoutTableSchema = z
  .object({
    id: nodeIdSchema,
    type: z.literal("table"),
    borders: tableBordersSchema.optional(),
    columns: z.array(layoutColumnSchema).min(1).max(paperTableLimits.columns),
    children: z.array(photoLayoutRowSchema).min(1).max(paperTableLimits.rows),
  })
  .strict()
  .superRefine((table, ctx) => {
    const ids = table.columns.map((column) => column.id)
    if (
      new Set(ids).size !== ids.length ||
      table.children.some(
        (row) =>
          row.children.length !== ids.length ||
          row.children.some((cell, index) => cell.columnId !== ids[index])
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Table must have unique columns and rectangular rows",
      })
  })
export const privatePhotoLayoutSchema = z
  .object({
    profile: z.literal("private-layout-2"),
    kind: z.enum(["cv", "letter"]),
    presentation: documentPresentationSchema,
    flow: z
      .object({
        id: nodeIdSchema,
        type: z.literal("flow"),
        children: z
          .array(
            z.union([
              photoLayoutTableSchema,
              formatOwnerSchema,
              formatBodySchema,
              layoutPhotoSchema,
            ])
          )
          .min(1)
          .max(10000),
      })
      .strict(),
  })
  .strict()
  .superRefine((doc, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message })
    const ids = new Set<string>()
    const identify = (id: string) => {
      if (ids.has(id)) fail("Duplicate layout identity")
      ids.add(id)
    }
    identify(doc.flow.id)
    const width =
      doc.presentation.page.width -
      doc.presentation.page.start -
      doc.presentation.page.end
    const inspect = (
      node: FormatNode | LayoutPhoto | LayoutTable | LayoutRow | LayoutCell,
      available: number
    ) => {
      identify(node.id)
      if ("photo" in node && node.photo !== undefined)
        fail("Layout v2 requires typed photo nodes")
      if (
        node.type === "photo" &&
        photoBounds(node).width + node.spacing.left + node.spacing.right >
          available + 0.000001
      )
        fail("Rotated photo exceeds its parent content width")
      if (node.type === "table") {
        node.columns.forEach((column) => identify(column.id))
        if (
          node.columns.reduce((sum, column) => sum + column.width, 0) >
          available
        )
          fail("Table exceeds the page content width")
        for (const row of node.children) {
          identify(row.id)
          for (const cell of row.children) {
            identify(cell.id)
            const column = node.columns.find(
              (entry) => entry.id === cell.columnId
            )
            if (!column) fail("Missing cell column")
            cell.children.forEach((child) =>
              inspect(child, (column?.width ?? 0) - 240)
            )
          }
        }
      } else if ("children" in node)
        node.children.forEach((child) => inspect(child, available))
    }
    doc.flow.children.forEach((node) => inspect(node, width))
    if (ids.size > 10000) fail("Too many layout nodes")
    const outer = doc.flow.children.filter(
      (node) => node.type !== "table" && node.type !== "photo"
    )
    const semantic = formattedDocumentSchema.safeParse({
      profile: "private-formatting-1",
      kind: doc.kind,
      presentation: doc.presentation,
      ...(doc.kind === "cv"
        ? { header: outer[0], blocks: outer.slice(1) }
        : { blocks: outer }),
    })
    if (!semantic.success) fail(semantic.error.message)
    if (doc.kind === "cv" && doc.flow.children[0]?.type !== "header")
      fail("The CV header must begin the flow")
    const cells = doc.flow.children.flatMap((node) =>
      node.type === "table"
        ? node.children.flatMap((row) =>
            row.children.flatMap((cell) =>
              cell.children.filter((child) => child.type !== "photo")
            )
          )
        : []
    )
    if (cells.length) {
      const body = formattedDocumentSchema.safeParse({
        profile: "private-formatting-1",
        kind: "letter",
        presentation: doc.presentation,
        blocks: cells,
      })
      if (!body.success) fail(body.error.message)
    }
  })
  .transform((doc) => {
    const visit = (
      node: FormatNode | LayoutPhoto | LayoutTable | LayoutRow | LayoutCell
    ) => {
      if ("content" in node) node.content = mergeFormatRuns(node.content)
      if ("children" in node) node.children.forEach(visit)
    }
    doc.flow.children.forEach(visit)
    return doc
  })
export const layoutDocumentSchema = z.union([
  privateLayoutSchema,
  privatePhotoLayoutSchema,
])
