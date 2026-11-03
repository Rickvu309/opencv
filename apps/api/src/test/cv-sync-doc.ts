import { paperDocumentSchema, type PaperDocument } from "@workspace/domain"

import { flat, wordsOf } from "./paper-client.js"

export type Node = {
  id: string
  type: string
  content?: { text: string }[]
  children?: Node[]
  items?: string[]
  title?: string
  kind?: string
  label?: string
  role?: string
  company?: string
  period?: string
  location?: string
  school?: string
  degree?: string
  detail?: string
}

export const HEADER_KEYS = [
  "name",
  "email",
  "phone",
  "city",
  "linkedin",
] as const
export const ENTRY_FIELDS = {
  experience: ["role", "company", "period", "location"],
  education: ["school", "degree", "period", "detail"],
  skills: ["label"],
  section: ["kind", "title"],
} as const

export const pick = <T>(items: readonly T[], at: number): T | undefined =>
  items.length === 0 ? undefined : items[at % items.length]

export const bullet = (
  id: string,
  text: string,
  children: Node[] = []
): Node => ({
  id,
  type: "bullet",
  content: [{ text }],
  children,
})

export function seed(): PaperDocument {
  return {
    version: 3,
    kind: "cv",
    header: {
      id: "header",
      type: "header",
      name: "Ada",
      email: "ada@ex.com",
      phone: "1",
      city: "London",
      linkedin: "ada",
    },
    blocks: [
      { id: "s1", type: "section", kind: "experience", title: "Experience" },
      {
        id: "e1",
        type: "experience",
        role: "Analyst",
        company: "Babbage",
        period: "1842",
        location: "London",
        children: [
          bullet("u1", "alpha beta", [
            bullet("u2", "gamma", [bullet("u3", "epsilon")]),
          ]),
          bullet("u4", "zeta eta"),
        ],
      },
      { id: "s2", type: "section", kind: "education", title: "Education" },
      {
        id: "d1",
        type: "education",
        school: "School",
        degree: "Maths",
        period: "1835",
        detail: "Notes",
        children: [bullet("u5", "theta iota")],
      },
      { id: "s3", type: "section", kind: "skills", title: "Skills" },
      {
        id: "k1",
        type: "skills",
        label: "Tools",
        items: ["Figma", "SQL", "C, C++"],
      },
    ],
    clashes: [],
  } as PaperDocument
}

export function nodes(doc: PaperDocument): Node[] {
  return doc.blocks as unknown as Node[]
}

export function clone(doc: PaperDocument): PaperDocument {
  return structuredClone(doc)
}

export function accept(doc: PaperDocument): PaperDocument | null {
  return paperDocumentSchema.safeParse(doc).success ? doc : null
}

export function parentOf(
  blocks: Node[],
  id: string
): { list: Node[]; index: number } | null {
  const at = blocks.findIndex((block) => block.id === id)
  if (at >= 0) return { list: blocks, index: at }
  for (const block of blocks) {
    if (!block.children) continue
    const inner = parentOf(block.children, id)
    if (inner) return inner
  }
  return null
}

export function fieldValue(
  doc: PaperDocument,
  key: string
): string | undefined {
  const [id, name] = key.split(".")
  if (!id || !name || doc.kind !== "cv") return undefined
  if (id === "header") {
    const value = doc.header[name as (typeof HEADER_KEYS)[number]]
    return typeof value === "string" ? value : undefined
  }
  const block = flat(doc.blocks).find((item) => item.id === id) as
    Node | undefined
  if (!block) return undefined
  if (name === "items") return JSON.stringify(block.items ?? [])
  const value = block[name as keyof Node]
  return typeof value === "string" ? value : undefined
}

export function subtreeWords(doc: PaperDocument, id: string) {
  const block = flat(doc.blocks).find((item) => item.id === id)
  if (!block) return []
  return wordsOf({ ...doc, blocks: [block] } as PaperDocument)
}
