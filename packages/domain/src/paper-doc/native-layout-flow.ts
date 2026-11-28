import { z } from "zod"
import { nodeIdSchema } from "./nodes.js"
import { paperPhotoFileId } from "./paper.js"
import {
  formatBodySchema,
  formatOwnerSchema,
  mergeFormatRuns,
  type FormatNode,
} from "./native-formatting.js"
import {
  layoutPhotoSchema,
  photoBounds,
  type LayoutPhoto,
} from "./native-photo.js"
import {
  layoutDocumentSchema,
  photoLayoutTableSchema,
  type LayoutTable,
  type LayoutRow,
  type LayoutCell,
} from "./native-layout.js"
import { documentPresentationSchema } from "./presentation-edit.js"
import { pageSchema, canonical } from "./presentation-values.js"

const flowPageBreakSchema = z
  .object({ id: nodeIdSchema, type: z.literal("pageBreak") })
  .strict()
const flowColumnsSchema = z
  .object({
    count: z.union([z.literal(1), z.literal(2)]),
    gap: z.number().int().min(0).max(31680),
  })
  .strict()
export const flowSectionSchema = z
  .object({
    id: nodeIdSchema,
    type: z.literal("flowSection"),
    start: z.enum(["continuous", "next-page"]),
    page: pageSchema,
    columns: flowColumnsSchema,
    children: z
      .array(
        z.union([
          formatBodySchema,
          formatOwnerSchema,
          photoLayoutTableSchema,
          layoutPhotoSchema,
          flowPageBreakSchema,
        ])
      )
      .min(1)
      .max(10000),
  })
  .strict()
export const flowDocumentSchema = z
  .object({
    profile: z.literal("private-layout-3"),
    kind: z.enum(["cv", "letter"]),
    presentation: documentPresentationSchema,
    flow: z
      .object({
        id: nodeIdSchema,
        type: z.literal("flow"),
        children: z.array(flowSectionSchema).min(1).max(1000),
      })
      .strict(),
  })
  .strict()
  .superRefine((document, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message })
    const ids = new Set<string>([document.flow.id])
    const sections = document.flow.children
    if (sections[0]?.start !== "continuous")
      fail("First section must be continuous")
    if (canonical(sections[0]?.page) !== canonical(document.presentation.page))
      fail("First section must use the document page")
    const identify = (
      node:
        | FlowSection
        | FormatNode
        | LayoutPhoto
        | LayoutTable
        | LayoutRow
        | LayoutCell
        | z.infer<typeof flowPageBreakSchema>
    ) => {
      if (ids.has(node.id)) fail("Duplicate flow identity")
      ids.add(node.id)
      if ("children" in node) node.children.forEach(identify)
    }
    let previous = sections[0]
    for (const section of sections) {
      identify(section)
      if (
        section.start === "continuous" &&
        previous &&
        canonical(previous.page) !== canonical(section.page)
      )
        fail("Continuous sections must retain page geometry")
      previous = section
      const width =
        (section.page.width -
          section.page.start -
          section.page.end -
          (section.columns.count - 1) * section.columns.gap) /
        section.columns.count
      if (width < 480) fail("Columns leave too little writing space")
      for (const node of section.children) {
        if (
          node.type === "table" &&
          node.columns.reduce((sum, column) => sum + column.width, 0) > width
        )
          fail("Table exceeds its flow column")
        if (
          node.type === "photo" &&
          photoBounds(node).width + node.spacing.left + node.spacing.right >
            width
        )
          fail("Photo exceeds its flow column")
      }
    }
    if (ids.size > 10000) fail("Too many flow nodes")
    const widest = sections.reduce((left, right) =>
      left.page.width - left.page.start - left.page.end >=
      right.page.width - right.page.start - right.page.end
        ? left
        : right
    )
    const withoutHeaderPortrait = (node: FlowNode) => {
      if (node.type !== "header" || node.photo === undefined) return node
      if (paperPhotoFileId(node.photo) === null)
        fail("Header portrait requires an owned file reference")
      const { photo: _photo, ...header } = node
      void _photo
      return header
    }
    const projection = layoutDocumentSchema.safeParse({
      profile: "private-layout-2",
      kind: document.kind,
      presentation: { ...document.presentation, page: widest.page },
      flow: {
        id: document.flow.id,
        type: "flow",
        children: sections.flatMap((section) =>
          section.children
            .filter((node) => node.type !== "pageBreak")
            .map(withoutHeaderPortrait)
        ),
      },
    })
    if (!projection.success)
      fail("Invalid flow content or semantic CV ownership")
  })
  .transform((document) => {
    const normalize = (
      node:
        | FormatNode
        | LayoutPhoto
        | LayoutTable
        | LayoutRow
        | LayoutCell
        | z.infer<typeof flowPageBreakSchema>
    ) => {
      if ("content" in node) node.content = mergeFormatRuns(node.content)
      if ("children" in node)
        for (const child of node.children) normalize(child)
    }
    document.flow.children.forEach((section) =>
      section.children.forEach(normalize)
    )
    return document
  })
export type FlowSection = z.infer<typeof flowSectionSchema>
type FlowNode = FlowSection["children"][number]
