import { z } from "zod"

import {
  cvBlockSchema,
  cvHeaderSchema,
  fieldSetMisfit,
  nodeFieldSetSchema,
  nodeIdSchema,
  paperNodeSpecs,
  proseBlockSchema,
  type CvPaperBlock,
  type CvSectionKind,
  type CvSectionMarker,
  type ListItem,
  type NodeId,
  type PaperNodeType,
} from "./nodes.js"

const MAX_CLASHES = 40

declare const clashIdBrand: unique symbol
export type ClashId = string & { readonly [clashIdBrand]: true }

const clashIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,64}$/)
  .transform((value) => value as ClashId)

const clashOfferSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("fields"), fields: nodeFieldSetSchema }).strict(),
  z.object({ kind: z.literal("remove") }).strict(),
  z
    .object({
      kind: z.literal("restore"),
      node: cvBlockSchema,
      at: z
        .object({
          parent: z.union([z.literal("body"), nodeIdSchema]),
          after: nodeIdSchema.nullable(),
        })
        .strict(),
    })
    .strict(),
])

export const clashSchema = z
  .object({
    id: clashIdSchema,
    node: nodeIdSchema,
    offer: clashOfferSchema,
    offeredBy: z.enum(["person", "coach", "undo"]),
    at: z.iso.datetime(),
  })
  .strict()

export type Clash = z.infer<typeof clashSchema>

const clashesSchema = z.array(clashSchema).max(MAX_CLASHES)

const cvPaperSchema = z
  .object({
    version: z.literal(3),
    kind: z.literal("cv"),
    header: cvHeaderSchema,
    blocks: z.array(cvBlockSchema),
    clashes: clashesSchema,
  })
  .strict()

const letterPaperSchema = z
  .object({
    version: z.literal(3),
    kind: z.literal("letter"),
    blocks: z.array(proseBlockSchema),
    clashes: clashesSchema,
  })
  .strict()

export type CvPaper = z.infer<typeof cvPaperSchema>
export type LetterPaper = z.infer<typeof letterPaperSchema>
export type PaperDocument = CvPaper | LetterPaper

type IssueSink = (message: string, path: (string | number)[]) => void

function itemsOf(block: CvPaperBlock): readonly ListItem[] {
  return block.type === "bullet" ||
    block.type === "numbered" ||
    block.type === "experience" ||
    block.type === "education"
    ? block.children
    : []
}

const ENTRY_TYPES: readonly string[] = ["experience", "education", "skills"]

function walkInvariants(document: PaperDocument, report: IssueSink): void {
  const typeById = new Map<string, PaperNodeType>()
  const claim = (
    id: string,
    type: PaperNodeType,
    path: (string | number)[]
  ) => {
    if (typeById.has(id)) report(`Duplicate id ${id}`, path)
    typeById.set(id, type)
  }
  const claimItems = (
    items: readonly ListItem[],
    path: (string | number)[]
  ) => {
    items.forEach((item, index) => {
      const itemPath = [...path, index]
      claim(item.id, item.type, itemPath)
      claimItems(item.children, [...itemPath, "children"])
    })
  }

  if (document.kind === "cv")
    claim(document.header.id, "header", ["header", "id"])
  let sectionSeen = false
  document.blocks.forEach((block, index) => {
    const path: (string | number)[] = ["blocks", index]
    claim(block.id, block.type, path)
    if (block.type === "section") sectionSeen = true
    if (ENTRY_TYPES.includes(block.type) && !sectionSeen) {
      report("An entry must come after a section", path)
    }
    claimItems(itemsOf(block), [...path, "children"])
  })

  const clashIds = new Set<string>()
  document.clashes.forEach((clash, index) => {
    const path: (string | number)[] = ["clashes", index]
    if (clashIds.has(clash.id)) report(`Duplicate clash ${clash.id}`, path)
    clashIds.add(clash.id)
    const target = typeById.get(clash.node)
    const { offer } = clash
    if (offer.kind === "restore") {
      if (
        document.kind === "letter" &&
        ENTRY_TYPES.concat("section").includes(offer.node.type)
      ) {
        report("A letter holds only text blocks", [...path, "offer", "node"])
      }
      const { parent, after } = offer.at
      if (parent !== "body" && !typeById.has(parent)) {
        report("A restore names a parent that is not in the paper", [
          ...path,
          "offer",
          "at",
          "parent",
        ])
      }
      if (after !== null && !typeById.has(after)) {
        report("A restore names a neighbour that is not in the paper", [
          ...path,
          "offer",
          "at",
          "after",
        ])
      }
      return
    }
    if (!target) {
      report("A clash names a block that is not in the paper", [
        ...path,
        "node",
      ])
      return
    }
    if (offer.kind === "fields") {
      const misfit = fieldSetMisfit(target, offer.fields)
      if (misfit) report(misfit, [...path, "offer", "fields"])
    }
  })
}

export const paperDocumentSchema = z
  .discriminatedUnion("kind", [cvPaperSchema, letterPaperSchema])
  .superRefine((document, context) => {
    walkInvariants(document, (message, path) =>
      context.addIssue({ code: "custom", message, path })
    )
  })

const SECTION_TITLES: Record<CvSectionKind, string> = {
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  activities: "Activities",
  awards: "Awards",
  languages: "Languages",
}

export function sectionMarker(
  kind: CvSectionKind,
  id: NodeId
): CvSectionMarker {
  return { id, type: "section", kind, title: SECTION_TITLES[kind] }
}

const STARTER_KINDS: readonly CvSectionKind[] = [
  "experience",
  "education",
  "skills",
]

export function blankCv(): CvPaper {
  return {
    version: 3,
    kind: "cv",
    header: paperNodeSpecs.header.blank(),
    blocks: STARTER_KINDS.map((kind) =>
      sectionMarker(kind, `section-${kind}` as NodeId)
    ),
    clashes: [],
  }
}

export function blankLetter(): LetterPaper {
  return {
    version: 3,
    kind: "letter",
    blocks: [paperNodeSpecs.paragraph.blank("letter-1" as NodeId)],
    clashes: [],
  }
}

export type SectionGroup = {
  readonly section: CvSectionMarker | null
  readonly blocks: readonly Exclude<CvPaperBlock, CvSectionMarker>[]
}

export function sectionsOf(document: CvPaper): SectionGroup[] {
  const groups: {
    section: CvSectionMarker | null
    blocks: SectionGroup["blocks"][number][]
  }[] = []
  for (const block of document.blocks) {
    if (block.type === "section") {
      groups.push({ section: block, blocks: [] })
      continue
    }
    let group = groups[groups.length - 1]
    if (!group) {
      group = { section: null, blocks: [] }
      groups.push(group)
    }
    group.blocks.push(block)
  }
  return groups
}
