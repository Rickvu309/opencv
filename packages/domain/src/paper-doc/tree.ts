import type { PaperDocument } from "./document.js"
import type { PaperNode } from "./nodes.js"

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
  if (doc.kind === "cv") {
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

export function cloned<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
