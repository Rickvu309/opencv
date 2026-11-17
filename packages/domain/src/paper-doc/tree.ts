import type { PaperDocument } from "./document.js"
import type { PaperNode } from "./nodes.js"
import { inlineMarkdownOf, plainTextOfRuns } from "./rich-text.js"

export type Entry = {
  readonly node: PaperNode
  readonly owner: string
  readonly list: PaperNode[] | null
}

export type Index = Map<string, Entry>

export function childrenOf(node: PaperNode): PaperNode[] | null {
  return "children" in node ? (node.children as PaperNode[]) : null
}

export function indexOf(doc: PaperDocument): Index {
  const index: Index = new Map()
  if (doc.kind === "cv" && doc.header) {
    index.set(doc.header.id, { node: doc.header, owner: "header", list: null })
  }
  const visit = (list: PaperNode[], owner: string) => {
    for (const node of list) {
      index.set(node.id, { node, owner, list })
      const kids = childrenOf(node)
      if (kids) visit(kids, node.id)
    }
  }
  visit(doc.blocks as PaperNode[], "body")
  return index
}

export function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) =>
    inner && typeof inner === "object" && !Array.isArray(inner)
      ? Object.fromEntries(
          Object.entries(inner).sort(([a], [b]) => (a < b ? -1 : 1))
        )
      : inner
  )
}

export function rebuiltBy(
  live: PaperDocument,
  merged: PaperDocument,
  ids: Iterable<string>
): string[] {
  const before = indexOf(live)
  const after = indexOf(merged)
  const out = new Set<string>()
  const visit = (node: PaperNode) => {
    out.add(node.id)
    for (const kid of childrenOf(node) ?? []) visit(kid)
  }
  for (const id of ids) {
    const found = after.get(id) ?? before.get(id)
    if (found) visit(found.node)
  }
  return [...out]
}

export function cloned<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

type Fields = {
  readonly text: Record<string, string>
  readonly props: Record<string, string>
}

const NOT_FIELDS = new Set(["id", "children", "content", "title"])

export function fieldsOf(node: PaperNode, markdown: boolean): Fields {
  const text: Record<string, string> = {}
  const props: Record<string, string> = {}
  const record = node as unknown as Record<string, unknown>
  if ("content" in node) {
    text.content = markdown
      ? inlineMarkdownOf(node.content)
      : plainTextOfRuns(node.content)
  }
  if (node.type === "section") text.title = node.title
  for (const [key, value] of Object.entries(record)) {
    if (!NOT_FIELDS.has(key)) props[key] = canonical(value)
  }
  return { text, props }
}
