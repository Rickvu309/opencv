import { cvSectionKindSchema } from "../paper-blocks/document.js"
import {
  paperDocumentSchema,
  sectionMarker,
  type PaperDocument,
} from "./document.js"
import type { NodeId } from "./nodes.js"
import { isSafeHref, richTextOf } from "./rich-text.js"
import { canonical, cloned, indexOf } from "./tree.js"

type Raw = Record<string, unknown> & {
  id?: unknown
  type?: unknown
  children?: Raw[]
}

export type RepairHints = {
  readonly fresh: ReadonlyMap<string, readonly boolean[]>
  readonly stale: ReadonlyMap<string, string>
}

export type PaperRepair = {
  readonly document: PaperDocument
  readonly repairs: string[]
  readonly moved: Set<string>
  readonly keep: Map<string, number>
}

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/
const ENTRY_TYPES = ["experience", "education", "skills"]
const PROSE_TYPES = ["paragraph", "heading", "bullet", "numbered", "divider"]
const MAX_ROUNDS = 6

type Context = {
  readonly repairs: string[]
  readonly moved: Set<string>
  readonly used: Set<string>
  readonly keep: Map<string, number>
  readonly hints: RepairHints
}

function freshId(context: Context, base: string): string {
  const stem = ID_PATTERN.test(base) ? base.slice(0, 50) : "block"
  for (let n = 1; ; n += 1) {
    const candidate = `${stem}-r${n}`
    if (!context.used.has(candidate)) {
      context.used.add(candidate)
      return candidate
    }
  }
}

function listsOf(doc: Raw): Raw[][] {
  const lists: Raw[][] = []
  const visit = (list: Raw[]) => {
    lists.push(list)
    for (const node of list)
      if (Array.isArray(node.children)) visit(node.children)
  }
  visit(doc.blocks as Raw[])
  return lists
}

function everyNode(doc: Raw): Raw[] {
  const nodes: Raw[] = []
  if (doc.header) nodes.push(doc.header as Raw)
  for (const list of listsOf(doc)) nodes.push(...list)
  return nodes
}

function cleanFields(doc: Raw, context: Context) {
  for (const node of everyNode(doc)) {
    if (typeof node.id !== "string" || !ID_PATTERN.test(node.id)) {
      node.id = freshId(context, "block")
      context.repairs.push("gave a block a valid id")
    }
    if (
      node.type === "section" &&
      !cvSectionKindSchema.safeParse(node.kind).success
    ) {
      node.kind = "summary"
      context.repairs.push("reset an unknown section kind")
    }
    if (node.type === "heading" && node.level !== 2 && node.level !== 3) {
      node.level = 2
      context.repairs.push("reset a heading level")
    }
    if (Array.isArray(node.content)) {
      for (const run of node.content as Record<string, unknown>[]) {
        if (typeof run.href === "string" && !isSafeHref(run.href)) {
          delete run.href
          context.repairs.push("removed an unsafe link")
        }
      }
    }
  }
}

function proseOf(node: Raw, text: string): Raw {
  return { id: node.id, type: "paragraph", content: richTextOf(text) }
}

function toLetter(doc: Raw, context: Context) {
  const blocks = doc.blocks as Raw[]
  for (let i = 0; i < blocks.length; i += 1) {
    const node = blocks[i]!
    if (PROSE_TYPES.includes(String(node.type))) continue
    context.repairs.push("turned a CV-only block into text for a letter")
    const lines =
      node.type === "section"
        ? [String(node.title ?? "")]
        : [
            ...[
              "label",
              "role",
              "company",
              "school",
              "degree",
              "period",
              "location",
              "detail",
            ]
              .map((key) => node[key])
              .filter(
                (value): value is string =>
                  typeof value === "string" && value !== ""
              ),
            ...(Array.isArray(node.items) ? (node.items as string[]) : []),
          ]
    const kids = Array.isArray(node.children) ? node.children : []
    const replacement =
      node.type === "section"
        ? {
            id: node.id,
            type: "heading",
            level: 2,
            content: richTextOf(lines.join(" ")),
          }
        : proseOf(node, lines.join(" · "))
    blocks.splice(i, 1, replacement as Raw, ...kids)
  }
}

function fit(list: Raw[], remaining: number, context: Context) {
  for (let i = 0; i < list.length; i += 1) {
    const item = list[i]!
    if (!Array.isArray(item.children) || item.children.length === 0) continue
    if (remaining === 0) {
      const lifted = item.children
      item.children = []
      list.splice(i + 1, 0, ...lifted)
      for (const kid of lifted) context.moved.add(String(kid.id))
      context.repairs.push("lifted a list item that nested too deep")
    } else {
      fit(item.children, remaining - 1, context)
    }
  }
}

function fitDepth(doc: Raw, context: Context) {
  for (const node of doc.blocks as Raw[]) {
    if (!Array.isArray(node.children)) continue
    if (node.type === "bullet" || node.type === "numbered") {
      fit(node.children, 1, context)
    } else {
      fit(node.children, 2, context)
    }
  }
}

function occurrences(doc: Raw) {
  const found = new Map<string, { node: Raw; owner: string; list: Raw[] }[]>()
  const add = (node: Raw, owner: string, list: Raw[]) => {
    const key = String(node.id)
    found.set(key, [...(found.get(key) ?? []), { node, owner, list }])
  }
  if (doc.header) add(doc.header as Raw, "header", [])
  const visit = (list: Raw[], owner: string) => {
    for (const node of list) {
      add(node, owner, list)
      if (Array.isArray(node.children)) visit(node.children, String(node.id))
    }
  }
  visit(doc.blocks as Raw[], "body")
  return found
}

type Twin = { node: Raw; owner: string; list: Raw[] }

function primaryOf(
  id: string,
  list: Twin[],
  previous: PaperDocument | null,
  context: Context
): number {
  const was = previous ? indexOf(previous).get(id) : undefined
  const stale = context.hints.stale.get(id)
  const fresh = context.hints.fresh.get(id) ?? []
  const open = list
    .map((_entry, at) => at)
    .filter((at) => stale === undefined || canonical(list[at]!.node) !== stale)
  const pool = open.length > 0 ? open : list.map((_entry, at) => at)
  const narrow = (from: number[], keep: (at: number) => boolean) => {
    const kept = from.filter(keep)
    return kept.length > 0 ? kept : from
  }
  const equal = narrow(pool, (at) =>
    was ? canonical(list[at]!.node) === canonical(was.node) : false
  )
  const owned = narrow(equal, (at) =>
    was ? list[at]!.owner === was.owner : false
  )
  return narrow(owned, (at) => fresh[at] === true)[0]!
}

function dedupe(doc: Raw, previous: PaperDocument | null, context: Context) {
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const clashes = [...occurrences(doc)].filter(([, list]) => list.length > 1)
    if (clashes.length === 0) return
    for (const [id, list] of clashes) {
      const at = primaryOf(id, list, previous, context)
      if (round === 0) context.keep.set(id, at)
      const primary = list[at]!
      const stale = context.hints.stale.get(id)
      for (const entry of list) {
        if (entry === primary) continue
        const sameAsPrimary = canonical(entry.node) === canonical(primary.node)
        const staleCopy = stale !== undefined && canonical(entry.node) === stale
        if ((sameAsPrimary || staleCopy) && entry.list.length > 0) {
          entry.list.splice(entry.list.indexOf(entry.node), 1)
          context.repairs.push("dropped a block that appeared twice")
        } else if (entry.node !== doc.header) {
          entry.node.id = freshId(context, id)
          context.moved.add(String(entry.node.id))
          context.repairs.push("kept a second block under a new id")
        }
      }
    }
  }
}

function sectionBeforeEntries(doc: Raw, context: Context) {
  if (doc.kind !== "cv") return
  const blocks = doc.blocks as Raw[]
  const firstSection = blocks.findIndex((node) => node.type === "section")
  const leading = blocks
    .slice(0, firstSection === -1 ? blocks.length : firstSection)
    .filter((node) => ENTRY_TYPES.includes(String(node.type)))
  if (leading.length === 0) return
  if (firstSection === -1) {
    const kind = String(leading[0]!.type)
    const marker = sectionMarker(
      kind as "experience",
      freshId(context, `section-${kind}`) as NodeId
    )
    blocks.splice(blocks.indexOf(leading[0]!), 0, marker as unknown as Raw)
    context.repairs.push("put back a section before an entry")
    return
  }
  for (const node of leading) blocks.splice(blocks.indexOf(node), 1)
  const at = blocks.findIndex((node) => node.type === "section") + 1
  blocks.splice(at, 0, ...leading)
  for (const node of leading) context.moved.add(String(node.id))
  context.repairs.push("moved an entry after the first section")
}

export function repairPaper(
  previous: PaperDocument | null,
  candidate: unknown,
  hints: RepairHints = { fresh: new Map(), stale: new Map() }
): PaperRepair | null {
  const doc = cloned(candidate) as Raw
  if (!Array.isArray(doc.blocks)) return null
  const context: Context = {
    repairs: [],
    moved: new Set(),
    used: new Set(),
    keep: new Map(),
    hints,
  }
  doc.clashes = []
  for (const node of everyNode(doc))
    if (typeof node.id === "string") context.used.add(node.id)
  cleanFields(doc, context)
  if (doc.kind === "letter") toLetter(doc, context)
  fitDepth(doc, context)
  dedupe(doc, previous, context)
  sectionBeforeEntries(doc, context)
  const parsed = paperDocumentSchema.safeParse(doc)
  if (!parsed.success) return null
  return {
    document: parsed.data,
    repairs: context.repairs,
    moved: context.moved,
    keep: context.keep,
  }
}

export function nodeFingerprint(doc: PaperDocument, id: string): string | null {
  const found = indexOf(doc).get(id)
  return found ? canonical(found.node) : null
}
