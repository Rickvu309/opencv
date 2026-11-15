import { z } from "zod"
import { nodeIdSchema } from "./nodes.js"
import {
  formatBodySchema,
  formatOwnerSchema,
  formattedDocumentSchema,
  mergeFormatRuns,
  type FormatNode,
} from "./native-formatting.js"
import { documentPresentationSchema } from "./presentation-edit.js"

export const layoutColumnSchema = z
  .object({
    id: nodeIdSchema,
    width: z.number().int().min(480).max(31680),
  })
  .strict()
export const layoutCellSchema = z
  .object({
    id: nodeIdSchema,
    type: z.literal("cell"),
    columnId: nodeIdSchema,
    children: z.array(formatBodySchema).min(1).max(1000),
  })
  .strict()
export const layoutRowSchema = z
  .object({
    id: nodeIdSchema,
    type: z.literal("row"),
    children: z.array(layoutCellSchema).min(1).max(20),
  })
  .strict()
export const layoutTableSchema = z
  .object({
    id: nodeIdSchema,
    type: z.literal("table"),
    columns: z.array(layoutColumnSchema).min(1).max(20),
    children: z.array(layoutRowSchema).min(1).max(100),
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
export type LayoutTable = z.infer<typeof layoutTableSchema>
export type LayoutRow = z.infer<typeof layoutRowSchema>
export type LayoutCell = z.infer<typeof layoutCellSchema>
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
    const visit = (node: FormatNode | LayoutTable | LayoutRow | LayoutCell) => {
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
    const visit = (node: FormatNode | LayoutTable | LayoutRow | LayoutCell) => {
      if ("content" in node) node.content = mergeFormatRuns(node.content)
      if ("children" in node) node.children.forEach(visit)
    }
    doc.flow.children.forEach(visit)
    return doc
  })
export type PrivateLayoutDocument = z.infer<typeof privateLayoutSchema>
