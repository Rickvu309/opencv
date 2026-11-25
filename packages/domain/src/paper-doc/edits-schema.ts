import { z } from "zod"

import { cvSectionKindSchema } from "./nodes.js"
import { nodeFieldSetSchema } from "./nodes.js"

const MAX_PAPER_EDITS = 40
const MAX_TEXT = 4000
const MAX_NEW_BLOCKS = 30
const MAX_ITEMS = 20

const EDIT_START = "@start"

const blockRefSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)
const anchorSchema = z.union([blockRefSchema, z.literal(EDIT_START)])
const markdownSchema = z.string().max(MAX_TEXT)

const leafItemSchema = z.object({ text: markdownSchema }).strict()
const midItemSchema = z
  .object({
    text: markdownSchema,
    children: z.array(leafItemSchema).max(MAX_ITEMS).optional(),
  })
  .strict()
const topItemSchema = z
  .object({
    text: markdownSchema,
    children: z.array(midItemSchema).max(MAX_ITEMS).optional(),
  })
  .strict()

const plain = z.string().max(MAX_TEXT)

const newBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("paragraph"), text: markdownSchema }).strict(),
  z
    .object({
      type: z.literal("heading"),
      level: z.union([z.literal(2), z.literal(3)]).default(2),
      text: markdownSchema,
    })
    .strict(),
  z
    .object({
      type: z.enum(["bullet", "numbered"]),
      text: markdownSchema,
      children: z.array(midItemSchema).max(MAX_ITEMS).optional(),
    })
    .strict(),
  z.object({ type: z.literal("divider") }).strict(),
  z
    .object({
      type: z.literal("section"),
      kind: cvSectionKindSchema,
      title: plain.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("experience"),
      role: plain,
      company: plain,
      period: plain.default(""),
      location: plain.default(""),
      bullets: z.array(topItemSchema).max(MAX_ITEMS).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("education"),
      school: plain,
      degree: plain.default(""),
      period: plain.default(""),
      detail: plain.default(""),
      bullets: z.array(topItemSchema).max(MAX_ITEMS).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("skills"),
      label: plain.default(""),
      items: z.array(z.string().min(1).max(200)).max(60),
    })
    .strict(),
])

const blocksSchema = z.array(newBlockSchema).min(1).max(MAX_NEW_BLOCKS)

const blockFieldsSchema = nodeFieldSetSchema.omit({
  type: true,
  content: true,
  title: true,
  photo: true,
  name: true,
  email: true,
  phone: true,
  city: true,
  linkedin: true,
})

const headerFieldsSchema = nodeFieldSetSchema.pick({
  name: true,
  email: true,
  phone: true,
  city: true,
  linkedin: true,
})

const paperEditSchema = z.discriminatedUnion("op", [
  z
    .object({
      op: z.literal("insert"),
      after: anchorSchema,
      blocks: blocksSchema,
    })
    .strict(),
  z
    .object({
      op: z.literal("insertInto"),
      into: blockRefSchema,
      blocks: blocksSchema,
    })
    .strict(),
  z
    .object({
      op: z.literal("setText"),
      blockId: blockRefSchema,
      text: markdownSchema,
    })
    .strict(),
  z
    .object({
      op: z.literal("setFields"),
      blockId: blockRefSchema,
      fields: blockFieldsSchema,
    })
    .strict(),
  z.object({ op: z.literal("setHeader"), fields: headerFieldsSchema }).strict(),
  z
    .object({
      op: z.literal("move"),
      blockId: blockRefSchema,
      after: anchorSchema,
    })
    .strict(),
  z.object({ op: z.literal("remove"), blockId: blockRefSchema }).strict(),
])

export const paperEditsSchema = z
  .array(paperEditSchema)
  .min(1)
  .max(MAX_PAPER_EDITS)

export const paperEditOutcomeSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("applied"),
      createdIds: z.array(z.string()).optional(),
      merged: z.literal(true).optional(),
    })
    .strict(),
  z.object({ status: z.literal("stale"), reason: z.string() }).strict(),
  z.object({ status: z.literal("invalid"), reason: z.string() }).strict(),
])
