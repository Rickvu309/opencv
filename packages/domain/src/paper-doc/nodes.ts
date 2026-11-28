import { z } from "zod"

import { paperPhotoValueSchema } from "./paper.js"

export const cvSectionKindSchema = z.enum([
  "summary",
  "experience",
  "education",
  "skills",
  "projects",
  "activities",
  "awards",
  "languages",
])
import {
  plainTextOfRuns,
  richTextInputSchema,
  richTextOf,
  type RichText,
} from "./rich-text.js"

declare const nodeIdBrand: unique symbol
export type NodeId = string & { readonly [nodeIdBrand]: true }

export const nodeIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,64}$/)
  .transform((value) => value as NodeId)

export const HEADER_NODE_ID = "header" as NodeId

export type CvSectionKind = z.infer<typeof cvSectionKindSchema>

const plainField = z.string()
const skillItemSchema = z.string().min(1)

export type ListItem = {
  id: NodeId
  type: "bullet" | "numbered"
  content: RichText
  children: ListItem[]
}

const MAX_LIST_DEPTH = 3

function listItemSchemaAt(levelsLeft: number): z.ZodType<ListItem> {
  return z
    .object({
      id: nodeIdSchema,
      type: z.enum(["bullet", "numbered"]),
      content: richTextInputSchema,
      children: childrenSchemaAt(levelsLeft - 1),
    })
    .strict()
}

function childrenSchemaAt(levelsLeft: number): z.ZodType<ListItem[]> {
  const none = `Lists nest at most ${MAX_LIST_DEPTH} deep`
  return (levelsLeft > 0
    ? z.array(listItemSchemaAt(levelsLeft))
    : z.array(z.any()).max(0, none)
  ).default([]) as unknown as z.ZodType<ListItem[]>
}

function listBlockSchema<T extends "bullet" | "numbered">(type: T) {
  return z
    .object({
      id: nodeIdSchema,
      type: z.literal(type),
      content: richTextInputSchema,
      children: childrenSchemaAt(MAX_LIST_DEPTH - 1),
    })
    .strict()
}

const headerSchema = z
  .object({
    id: z.literal(HEADER_NODE_ID).transform((value) => value as NodeId),
    type: z.literal("header"),
    name: plainField,
    email: plainField,
    phone: plainField,
    city: plainField,
    linkedin: plainField,
    photo: paperPhotoValueSchema.optional(),
  })
  .strict()

const sectionSchema = z
  .object({
    id: nodeIdSchema,
    type: z.literal("section"),
    kind: cvSectionKindSchema,
    title: plainField,
  })
  .strict()

const paragraphSchema = z
  .object({
    id: nodeIdSchema,
    type: z.literal("paragraph"),
    content: richTextInputSchema,
  })
  .strict()

const headingSchema = z
  .object({
    id: nodeIdSchema,
    type: z.literal("heading"),
    level: z.union([z.literal(2), z.literal(3)]),
    content: richTextInputSchema,
  })
  .strict()

const bulletSchema = listBlockSchema("bullet")
const numberedSchema = listBlockSchema("numbered")

const dividerSchema = z
  .object({ id: nodeIdSchema, type: z.literal("divider") })
  .strict()

const experienceSchema = z
  .object({
    id: nodeIdSchema,
    type: z.literal("experience"),
    role: plainField,
    company: plainField,
    period: plainField,
    location: plainField,
    children: childrenSchemaAt(MAX_LIST_DEPTH),
  })
  .strict()

const educationSchema = z
  .object({
    id: nodeIdSchema,
    type: z.literal("education"),
    school: plainField,
    degree: plainField,
    period: plainField,
    detail: plainField,
    children: childrenSchemaAt(MAX_LIST_DEPTH),
  })
  .strict()

const skillsSchema = z
  .object({
    id: nodeIdSchema,
    type: z.literal("skills"),
    label: plainField,
    items: z.array(skillItemSchema),
  })
  .strict()

type CvHeader = z.infer<typeof headerSchema>
export type CvSectionMarker = z.infer<typeof sectionSchema>
export type Paragraph = z.infer<typeof paragraphSchema>
export type Heading = z.infer<typeof headingSchema>
export type Bullet = z.infer<typeof bulletSchema>
export type Numbered = z.infer<typeof numberedSchema>
export type Divider = z.infer<typeof dividerSchema>
type ExperienceEntry = z.infer<typeof experienceSchema>
type EducationEntry = z.infer<typeof educationSchema>
type SkillsGroup = z.infer<typeof skillsSchema>

export type ProseBlock = Paragraph | Heading | Bullet | Numbered | Divider
type EntryBlock = ExperienceEntry | EducationEntry | SkillsGroup
export type CvPaperBlock = CvSectionMarker | ProseBlock | EntryBlock
type PaperNode = CvHeader | CvPaperBlock | ListItem

export const proseBlockSchema = z.discriminatedUnion("type", [
  paragraphSchema,
  headingSchema,
  bulletSchema,
  numberedSchema,
  dividerSchema,
])

export const cvBlockSchema = z.discriminatedUnion("type", [
  sectionSchema,
  paragraphSchema,
  headingSchema,
  bulletSchema,
  numberedSchema,
  dividerSchema,
  experienceSchema,
  educationSchema,
  skillsSchema,
])

export const cvHeaderSchema = headerSchema

type NodeSpec<N extends PaperNode> = {
  readonly type: N["type"]
  readonly schema: z.ZodType<N>
  readonly blank: (id: NodeId) => N
  readonly slash?: { readonly label: string; readonly hint: string }
  readonly turnInto: readonly PaperNode["type"][]
  readonly plainText: (node: N) => string
}

type SpecTable = {
  readonly [T in PaperNode["type"]]: NodeSpec<Extract<PaperNode, { type: T }>>
}

function joinLines(parts: readonly string[]): string {
  return parts.filter((part) => part.length > 0).join("\n")
}

function itemLines(items: readonly ListItem[]): string[] {
  return items.flatMap((item) => [
    plainTextOfRuns(item.content),
    ...itemLines(item.children),
  ])
}

function listItemText(item: ListItem): string {
  return joinLines(itemLines([item]))
}

const PROSE_TURN_INTO = ["paragraph", "heading", "bullet", "numbered"] as const

function turnIntoOthers(type: (typeof PROSE_TURN_INTO)[number]) {
  return PROSE_TURN_INTO.filter((other) => other !== type)
}

const paperNodeSpecs = {
  header: {
    type: "header",
    schema: headerSchema,
    blank: () => ({
      id: HEADER_NODE_ID,
      type: "header",
      name: "",
      email: "",
      phone: "",
      city: "",
      linkedin: "",
    }),
    turnInto: [],
    plainText: (node) =>
      joinLines([node.name, node.email, node.phone, node.city, node.linkedin]),
  },
  section: {
    type: "section",
    schema: sectionSchema,
    blank: (id) => ({ id, type: "section", kind: "summary", title: "" }),
    turnInto: [],
    plainText: (node) => node.title,
  },
  paragraph: {
    type: "paragraph",
    schema: paragraphSchema,
    blank: (id) => ({ id, type: "paragraph", content: richTextOf("") }),
    slash: { label: "Text", hint: "A paragraph" },
    turnInto: turnIntoOthers("paragraph"),
    plainText: (node) => plainTextOfRuns(node.content),
  },
  heading: {
    type: "heading",
    schema: headingSchema,
    blank: (id) => ({
      id,
      type: "heading",
      level: 2,
      content: richTextOf(""),
    }),
    slash: { label: "Heading", hint: "A title" },
    turnInto: turnIntoOthers("heading"),
    plainText: (node) => plainTextOfRuns(node.content),
  },
  bullet: {
    type: "bullet",
    schema: bulletSchema,
    blank: (id) => ({
      id,
      type: "bullet",
      content: richTextOf(""),
      children: [],
    }),
    slash: { label: "Bulleted list", hint: "Points in a list" },
    turnInto: turnIntoOthers("bullet"),
    plainText: listItemText,
  },
  numbered: {
    type: "numbered",
    schema: numberedSchema,
    blank: (id) => ({
      id,
      type: "numbered",
      content: richTextOf(""),
      children: [],
    }),
    slash: { label: "Numbered list", hint: "Steps in order" },
    turnInto: turnIntoOthers("numbered"),
    plainText: listItemText,
  },
  divider: {
    type: "divider",
    schema: dividerSchema,
    blank: (id) => ({ id, type: "divider" }),
    slash: { label: "Divider", hint: "A line between blocks" },
    turnInto: [],
    plainText: () => "",
  },
  experience: {
    type: "experience",
    schema: experienceSchema,
    blank: (id) => ({
      id,
      type: "experience",
      role: "",
      company: "",
      period: "",
      location: "",
      children: [],
    }),
    turnInto: [],
    plainText: (node) =>
      joinLines([
        node.role,
        node.company,
        node.period,
        node.location,
        ...itemLines(node.children),
      ]),
  },
  education: {
    type: "education",
    schema: educationSchema,
    blank: (id) => ({
      id,
      type: "education",
      school: "",
      degree: "",
      period: "",
      detail: "",
      children: [],
    }),
    turnInto: [],
    plainText: (node) =>
      joinLines([
        node.school,
        node.degree,
        node.period,
        node.detail,
        ...itemLines(node.children),
      ]),
  },
  skills: {
    type: "skills",
    schema: skillsSchema,
    blank: (id) => ({ id, type: "skills", label: "", items: [] }),
    turnInto: [],
    plainText: (node) => joinLines([node.label, ...node.items]),
  },
} satisfies SpecTable

export type PaperNodeType = keyof typeof paperNodeSpecs

export const nodeFieldSetSchema = z
  .object({
    type: z
      .string()
      .refine((value): value is PaperNodeType =>
        Object.hasOwn(paperNodeSpecs, value)
      )
      .optional(),
    content: richTextInputSchema.optional(),
    level: z.union([z.literal(2), z.literal(3)]).optional(),
    title: plainField.optional(),
    kind: cvSectionKindSchema.optional(),
    role: plainField.optional(),
    company: plainField.optional(),
    period: plainField.optional(),
    location: plainField.optional(),
    school: plainField.optional(),
    degree: plainField.optional(),
    detail: plainField.optional(),
    label: plainField.optional(),
    items: z.array(skillItemSchema).optional(),
    name: plainField.optional(),
    email: plainField.optional(),
    phone: plainField.optional(),
    city: plainField.optional(),
    linkedin: plainField.optional(),
    photo: paperPhotoValueSchema.nullable().optional(),
  })
  .strict()
type NodeFieldSet = z.infer<typeof nodeFieldSetSchema>

const FIELDS_OF_TYPE = {
  header: ["name", "email", "phone", "city", "linkedin", "photo"],
  section: ["kind", "title"],
  paragraph: ["content"],
  heading: ["content", "level"],
  bullet: ["content"],
  numbered: ["content"],
  divider: [],
  experience: ["role", "company", "period", "location"],
  education: ["school", "degree", "period", "detail"],
  skills: ["label", "items"],
} satisfies Record<PaperNodeType, readonly (keyof NodeFieldSet)[]>

export function fieldSetMisfit(
  type: PaperNodeType,
  fields: NodeFieldSet
): string | null {
  const allowed: readonly string[] = FIELDS_OF_TYPE[type]
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue
    if (key === "type") {
      const turnInto: readonly string[] = paperNodeSpecs[type].turnInto
      if (!turnInto.includes(value as string)) {
        return `A ${type} cannot turn into ${String(value)}`
      }
    } else if (!allowed.includes(key)) {
      return `A ${type} has no field ${key}`
    }
  }
  return null
}
