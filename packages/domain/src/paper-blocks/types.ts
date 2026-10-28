import type { ZodType } from "zod"

export const BLOCK_TYPE_NAMES = [
  "text",
  "heading",
  "bulleted-list",
  "numbered-list",
  "divider",
  "experience-entry",
  "education-entry",
  "skills-group",
] as const

export type BlockType = (typeof BLOCK_TYPE_NAMES)[number]

export type ListItem = { id: string; text: string }

export type TextBlock = { id: string; type: "text"; text: string }
export type HeadingBlock = { id: string; type: "heading"; text: string }
export type BulletedListBlock = {
  id: string
  type: "bulleted-list"
  items: ListItem[]
}
export type NumberedListBlock = {
  id: string
  type: "numbered-list"
  items: ListItem[]
}
export type DividerBlock = { id: string; type: "divider" }
export type ExperienceEntryBlock = {
  id: string
  type: "experience-entry"
  role: string
  company: string
  period: string
  bullets: ListItem[]
}
export type EducationEntryBlock = {
  id: string
  type: "education-entry"
  school: string
  degree: string
  period: string
  detail: string
}
export type SkillsGroupBlock = {
  id: string
  type: "skills-group"
  label: string
  items: string[]
}

export type CvBlock =
  | TextBlock
  | HeadingBlock
  | BulletedListBlock
  | NumberedListBlock
  | DividerBlock
  | ExperienceEntryBlock
  | EducationEntryBlock
  | SkillsGroupBlock

export type PreviewFragment =
  | { kind: "text"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "divider" }
  | {
      kind: "experience"
      role: string
      company: string
      period: string
      bullets: string[]
    }
  | {
      kind: "education"
      school: string
      degree: string
      period: string
      detail: string
    }
  | { kind: "skills"; label: string; items: string[] }

export type SlashOffer = {
  label: string
  hint: string
  group: "blocks"
}

export type BlockRegistryEntry = {
  type: BlockType
  schema: ZodType<CvBlock>
  empty: () => CvBlock
  slash?: SlashOffer
  print: (block: CvBlock) => PreviewFragment
  plainText: (block: CvBlock) => string
  turnInto: readonly BlockType[]
}
