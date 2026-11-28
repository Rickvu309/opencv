import { z } from "zod"
import { paperPhotoValueSchema } from "./paper.js"
import { nodeIdSchema, cvSectionKindSchema } from "./nodes.js"
import { nativeCvDocumentSchema, type CvOwner } from "./native-cv.js"
import { type CvField } from "./cv-fields.js"
import { safeHrefSchema, type SafeHref } from "./rich-text.js"
import {
  inlineSchema,
  paragraphSchema,
  canonical,
} from "./presentation-values.js"
import {
  documentPresentationSchema,
  checkSnapshot,
  isWellFormed,
} from "./presentation-edit.js"

const formatHrefSchema: z.ZodType<SafeHref, string> = safeHrefSchema
export const formatRunSchema = inlineSchema
  .extend({
    text: z
      .string()
      .min(1)
      .max(1000000)
      .refine(isWellFormed)
      .refine((v) =>
        [...v].every((char) => {
          const code = char.charCodeAt(0)
          return code === 9 || code === 10 || (code >= 32 && code !== 127)
        })
      ),
    href: formatHrefSchema.optional(),
  })
  .strict()
export type FormatRun = z.infer<typeof formatRunSchema>
export const formatRunsSchema = z.array(formatRunSchema).max(10000)
export type FormatField = Omit<CvField, "content"> & {
  content: FormatRun[]
  paragraph: z.infer<typeof paragraphSchema>
}
export type FormatBody =
  | {
      id: z.infer<typeof nodeIdSchema>
      type: "paragraph"
      content: FormatRun[]
      paragraph: z.infer<typeof paragraphSchema>
    }
  | {
      id: z.infer<typeof nodeIdSchema>
      type: "heading"
      level: 2 | 3
      content: FormatRun[]
      paragraph: z.infer<typeof paragraphSchema>
    }
  | {
      id: z.infer<typeof nodeIdSchema>
      type: "bullet" | "numbered"
      content: FormatRun[]
      paragraph: z.infer<typeof paragraphSchema>
      children: FormatBody[]
    }
  | { id: z.infer<typeof nodeIdSchema>; type: "divider" }
export type FormatOwner = Omit<CvOwner, "children"> & {
  children: (FormatField | FormatBody)[]
}
export type FormatNode = FormatOwner | FormatBody | FormatField
const inline = {
  id: nodeIdSchema,
  content: formatRunsSchema,
  paragraph: paragraphSchema,
}
const bodyAt = (depth: number): z.ZodType<FormatBody> =>
  z.union([
    z.object({ ...inline, type: z.literal("paragraph") }).strict(),
    z
      .object({
        ...inline,
        type: z.literal("heading"),
        level: z.union([z.literal(2), z.literal(3)]),
      })
      .strict(),
    z
      .object({
        ...inline,
        type: z.enum(["bullet", "numbered"]),
        children:
          depth > 1
            ? z.array(z.lazy(() => bodyAt(depth - 1)))
            : z.array(z.never()),
      })
      .strict(),
    z.object({ id: nodeIdSchema, type: z.literal("divider") }).strict(),
  ])
export const formatBodySchema = bodyAt(3)
const field: z.ZodType<FormatField> = z
  .object({
    ...inline,
    type: z.literal("cvField"),
    ownerId: nodeIdSchema,
    fieldKey: z.enum([
      "name",
      "headline",
      "email",
      "phone",
      "city",
      "linkedin",
      "title",
      "role",
      "company",
      "period",
      "location",
      "school",
      "degree",
      "detail",
      "label",
      "item",
    ]),
    itemId: nodeIdSchema.optional(),
  })
  .strict()
export const formatOwnerSchema: z.ZodType<FormatOwner> = z
  .object({
    id: nodeIdSchema,
    type: z.enum(["header", "section", "experience", "education", "skills"]),
    kind: cvSectionKindSchema.optional(),
    photo: paperPhotoValueSchema.optional(),
    children: z.array(z.union([field, formatBodySchema])),
  })
  .strict()
export const formattedDocumentSchema = z
  .discriminatedUnion("kind", [
    z
      .object({
        profile: z.literal("private-formatting-1"),
        kind: z.literal("letter"),
        presentation: documentPresentationSchema,
        blocks: z.array(formatBodySchema),
      })
      .strict(),
    z
      .object({
        profile: z.literal("private-formatting-1"),
        kind: z.literal("cv"),
        presentation: documentPresentationSchema,
        header: formatOwnerSchema,
        blocks: z.array(z.union([formatOwnerSchema, formatBodySchema])),
      })
      .strict(),
  ])
  .superRefine((doc, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message })
    const nodes: FormatNode[] = []
    const visit = (node: FormatNode) => {
      nodes.push(node)
      if ("children" in node) node.children.forEach(visit)
    }
    if (doc.kind === "cv") visit(doc.header)
    doc.blocks.forEach(visit)
    if (nodes.length > 10000) fail("Too many blocks")
    if (new Set(nodes.map((n) => n.id)).size !== nodes.length)
      fail("Duplicate block identity")
    const skeleton = (node: FormatNode): unknown => {
      if ("content" in node) {
        const rest = Object.fromEntries(
          Object.entries(node).filter(
            ([key]) => key !== "paragraph" && key !== "content"
          )
        )
        return {
          ...rest,
          content: [],
          ...("children" in node
            ? { children: node.children.map(skeleton) }
            : {}),
        }
      }
      return {
        ...node,
        ...("children" in node
          ? { children: node.children.map(skeleton) }
          : {}),
      }
    }
    if (
      doc.kind === "cv" &&
      !nativeCvDocumentSchema.safeParse({
        version: 4,
        schemaRevision: 2,
        kind: "cv",
        header: skeleton(doc.header),
        blocks: doc.blocks.map(skeleton),
      }).success
    )
      fail("Invalid semantic CV identity, slots or ordering")
    for (const node of nodes)
      if (
        node.type === "cvField" &&
        node.content.some((r) => /[\t\n\r]/u.test(r.text))
      )
        fail("Field contains line control")
    const basis = checkSnapshot({
      document: doc.presentation,
      blocks: nodes.flatMap((node) =>
        "content" in node
          ? [
              {
                ownerId: node.id,
                paragraph: node.paragraph,
                runs: node.content.map((run) => ({
                  text: run.text,
                  values: Object.fromEntries(
                    Object.entries(run).filter(
                      ([key]) => key !== "text" && key !== "href"
                    )
                  ),
                })),
              },
            ]
          : []
      ),
    })
    if (basis.kind === "refused") fail(basis.reason)
  })
  .transform((doc) => {
    const visit = (node: FormatNode) => {
      if ("content" in node) node.content = mergeFormatRuns(node.content)
      if ("children" in node) node.children.forEach(visit)
    }
    if (doc.kind === "cv") visit(doc.header)
    doc.blocks.forEach(visit)
    return doc
  })
export function mergeFormatRuns(runs: readonly FormatRun[]): FormatRun[] {
  const out: FormatRun[] = []
  for (const run of runs) {
    const { text, ...marks } = run
    const prior = out.at(-1)
    if (prior) {
      const { text: previous, ...before } = prior
      if (canonical(before) === canonical(marks)) {
        prior.text = previous + text
        continue
      }
    }
    out.push({ ...run })
  }
  return out
}
