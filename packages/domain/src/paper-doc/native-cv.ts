import { z } from "zod"

import { paperPhotoValueSchema } from "../paper.js"
import {
  cvFieldSchema,
  cvRichTextSchema,
  cvSlots,
  type CvField,
} from "./cv-fields.js"
import {
  cvSectionKindSchema,
  nodeIdSchema,
  type NodeId,
  type CvSectionKind,
} from "./nodes.js"
import type { RichText } from "./rich-text.js"

export type CvBody =
  | { id: NodeId; type: "paragraph"; content: RichText }
  | { id: NodeId; type: "heading"; level: 2 | 3; content: RichText }
  | {
      id: NodeId
      type: "bullet" | "numbered"
      content: RichText
      children: CvBody[]
    }
  | { id: NodeId; type: "divider" }

const bodyAt = (depth: number): z.ZodType<CvBody> =>
  z.union([
    z
      .object({
        id: nodeIdSchema,
        type: z.literal("paragraph"),
        content: cvRichTextSchema,
      })
      .strict(),
    z
      .object({
        id: nodeIdSchema,
        type: z.literal("heading"),
        level: z.union([z.literal(2), z.literal(3)]),
        content: cvRichTextSchema,
      })
      .strict(),
    z
      .object({
        id: nodeIdSchema,
        type: z.enum(["bullet", "numbered"]),
        content: cvRichTextSchema,
        children:
          depth > 1
            ? z.array(z.lazy(() => bodyAt(depth - 1)))
            : z.array(z.never()),
      })
      .strict(),
    z.object({ id: nodeIdSchema, type: z.literal("divider") }).strict(),
  ])
export const cvBodySchema = bodyAt(3)
export type CvOwnerType = keyof typeof cvSlots
export type CvOwner = {
  id: NodeId
  type: CvOwnerType
  kind?: CvSectionKind
  photo?: z.infer<typeof paperPhotoValueSchema>
  children: (CvField | CvBody)[]
}

const ownerSchema = z
  .object({
    id: nodeIdSchema,
    type: z.enum(["header", "section", "experience", "education", "skills"]),
    kind: cvSectionKindSchema.optional(),
    photo: paperPhotoValueSchema.refine((photo) => photo.length > 0).optional(),
    children: z.array(z.union([cvFieldSchema, cvBodySchema])),
  })
  .strict()
  .superRefine((owner, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message })
    if ((owner.type === "section") !== (owner.kind !== undefined))
      fail("Only sections require kind")
    if (owner.type !== "header" && owner.photo !== undefined)
      fail("Only header owns photo")
    const slots = cvSlots[owner.type]
    slots.forEach((key, index) => {
      const field = owner.children[index]
      if (
        !field ||
        field.type !== "cvField" ||
        field.fieldKey !== key ||
        field.ownerId !== owner.id
      )
        fail(`Missing or misplaced fixed slot ${key}`)
    })
    owner.children.slice(slots.length).forEach((child) => {
      if (owner.type === "header" || owner.type === "section")
        fail("Owner accepts fixed fields only")
      else if (owner.type === "skills") {
        if (
          child.type !== "cvField" ||
          child.fieldKey !== "item" ||
          child.ownerId !== owner.id
        )
          fail("Skills accept ordered item fields only")
      } else if (child.type === "cvField")
        fail("Fields must form the declared prefix")
    })
  })

export type NativeCvDocument = {
  version: 4
  schemaRevision: 2
  kind: "cv"
  header: CvOwner
  blocks: (CvOwner | CvBody)[]
}

export const nativeCvDocumentSchema: z.ZodType<NativeCvDocument> = z
  .object({
    version: z.literal(4),
    schemaRevision: z.literal(2),
    kind: z.literal("cv"),
    header: ownerSchema.refine((owner) => owner.type === "header"),
    blocks: z.array(
      z.union([
        ownerSchema.refine((owner) => owner.type !== "header"),
        cvBodySchema,
      ])
    ),
  })
  .strict()
  .superRefine((document, ctx) => {
    const ids = new Set<string>()
    const claim = (id: string) => {
      if (ids.has(id))
        ctx.addIssue({ code: "custom", message: `Duplicate identity ${id}` })
      ids.add(id)
    }
    const visit = (node: CvOwner | CvBody | CvField) => {
      claim(node.id)
      if (node.type === "cvField" && node.itemId) claim(node.itemId)
      if ("children" in node) node.children.forEach(visit)
    }
    visit(document.header)
    document.blocks.forEach(visit)
    let sectionSeen = false
    for (const block of document.blocks) {
      if (block.type === "section") sectionSeen = true
      if (
        ["experience", "education", "skills"].includes(block.type) &&
        !sectionSeen
      )
        ctx.addIssue({
          code: "custom",
          message: "Entries require a preceding section occurrence",
        })
    }
  })

export function cvOwners(document: NativeCvDocument): CvOwner[] {
  return [
    document.header,
    ...document.blocks.filter(
      (block): block is CvOwner => block.type in cvSlots
    ),
  ]
}
