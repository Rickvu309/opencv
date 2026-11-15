import { z } from "zod"
import { nodeIdSchema } from "./nodes.js"
import {
  flowDocumentSchema,
  flowSectionSchema,
  type FlowDocument,
  type FlowNode,
} from "./native-layout-flow.js"
import { canonical, ok, refuse } from "./presentation-values.js"

const settings = flowSectionSchema.omit({
  id: true,
  type: true,
  children: true,
})
const sectionStructure = settings
  .extend({
    id: nodeIdSchema,
    children: z
      .array(z.object({ id: nodeIdSchema, type: z.string() }).strict())
      .min(1),
  })
  .strict()
const structureSchema = z.array(sectionStructure).min(1).max(1000)
export const flowReceiptSchema = z
  .object({
    version: z.literal(1),
    flowId: nodeIdSchema,
    kind: z.enum(["cv", "letter"]),
    before: structureSchema,
    after: structureSchema,
  })
  .strict()
  .superRefine((receipt, ctx) => {
    const content = (sections: z.infer<typeof structureSchema>) =>
      sections.flatMap((section) =>
        section.children.filter((node) => node.type !== "pageBreak")
      )
    if (
      canonical(content(receipt.before)) !== canonical(content(receipt.after))
    )
      ctx.addIssue({
        code: "custom",
        message: "Flow receipts cannot add, remove or reorder document content",
      })
  })
type FlowReceipt = z.infer<typeof flowReceiptSchema>
const flowEditSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("section-settings"),
      sectionId: nodeIdSchema,
      settings,
    })
    .strict(),
  z
    .object({
      kind: z.literal("split-section"),
      sectionId: nodeIdSchema,
      beforeId: nodeIdSchema,
      newSectionId: nodeIdSchema,
      settings,
    })
    .strict(),
  z
    .object({ kind: z.literal("merge-section"), sectionId: nodeIdSchema })
    .strict(),
  z
    .object({
      kind: z.literal("insert-page-break"),
      sectionId: nodeIdSchema,
      beforeId: nodeIdSchema.nullable(),
      breakId: nodeIdSchema,
    })
    .strict(),
  z
    .object({ kind: z.literal("remove-page-break"), breakId: nodeIdSchema })
    .strict(),
])
function structure(document: FlowDocument): FlowReceipt["before"] {
  return document.flow.children.map(
    ({ id, start, page, columns, children }) => ({
      id,
      start,
      page,
      columns,
      children: children.map(({ id, type }) => ({ id, type })),
    })
  )
}
function finish(document: FlowDocument) {
  const first = document.flow.children[0]
  if (!first) throw new Error("Flow needs a section")
  document.presentation.page = first.page
  return flowDocumentSchema.parse(document)
}
export function prepareFlowEdit(input: unknown, editInput: unknown) {
  try {
    const before = flowDocumentSchema.parse(input)
    const document = flowDocumentSchema.parse(before)
    const edit = flowEditSchema.parse(editInput)
    if (edit.kind === "remove-page-break") {
      const section = document.flow.children.find((section) =>
        section.children.some(
          (node) => node.id === edit.breakId && node.type === "pageBreak"
        )
      )
      if (!section) throw new Error("Page break is missing")
      section.children = section.children.filter(
        (node) => node.id !== edit.breakId
      )
    } else {
      const index = document.flow.children.findIndex(
        (section) => section.id === edit.sectionId
      )
      const section = document.flow.children[index]
      if (!section) throw new Error("Section is missing")
      switch (edit.kind) {
        case "section-settings":
          Object.assign(section, edit.settings)
          break
        case "split-section": {
          const offset = section.children.findIndex(
            (node) => node.id === edit.beforeId
          )
          if (offset <= 0)
            throw new Error("A split must retain content on both sides")
          const children = section.children.splice(offset)
          document.flow.children.splice(index + 1, 0, {
            id: edit.newSectionId,
            type: "flowSection",
            ...edit.settings,
            children,
          })
          break
        }
        case "merge-section": {
          const previous = document.flow.children[index - 1]
          if (!previous)
            throw new Error("The first section cannot be merged backwards")
          previous.children.push(...section.children)
          document.flow.children.splice(index, 1)
          break
        }
        case "insert-page-break": {
          const offset =
            edit.beforeId === null
              ? section.children.length
              : section.children.findIndex((node) => node.id === edit.beforeId)
          if (offset < 0) throw new Error("Break anchor is missing")
          section.children.splice(offset, 0, {
            id: edit.breakId,
            type: "pageBreak",
          })
          break
        }
      }
    }
    const after = finish(document)
    return ok({
      document: after,
      receipt: flowReceiptSchema.parse({
        version: 1,
        flowId: before.flow.id,
        kind: before.kind,
        before: structure(before),
        after: structure(after),
      }),
    })
  } catch (error) {
    return refuse(error instanceof Error ? error.message : "Flow edit refused")
  }
}
export function reverseFlowEdit(input: unknown, receiptInput: unknown) {
  try {
    const document = flowDocumentSchema.parse(input)
    const receipt = flowReceiptSchema.parse(receiptInput)
    if (document.flow.id !== receipt.flowId || document.kind !== receipt.kind)
      throw new Error("Flow receipt belongs to another document")
    if (canonical(structure(document)) !== canonical(receipt.after))
      throw new Error("Flow layout changed after this operation")
    const content = new Map<string, FlowNode>(
      document.flow.children.flatMap((section) =>
        section.children.map((node) => [node.id, node])
      )
    )
    document.flow.children = receipt.before.map(({ children, ...section }) => ({
      ...section,
      type: "flowSection",
      children: children.map(({ id, type }) => {
        if (type === "pageBreak") return { id, type }
        const node = content.get(id)
        if (!node || node.type !== type)
          throw new Error("Flow content changed identity")
        return node
      }),
    }))
    return ok(finish(document))
  } catch (error) {
    return refuse(error instanceof Error ? error.message : "Flow Undo refused")
  }
}
