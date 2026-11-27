import type { Node } from "prosemirror-model"
import { documentSchema, type Document } from "@workspace/domain/paper-doc"

import { paperSchema } from "./schema.js"

const documents = new WeakMap<Node, Document>()
const blocks = new WeakMap<Node, BlockJson>()

type BlockJson = { type: string; attrs?: Record<string, unknown> }

function blockJson(node: Node): BlockJson {
  let block = blocks.get(node)
  if (!block) {
    block = node.toJSON() as BlockJson
    if (block.type === "text_block" && block.attrs?.rightTabMpt === null) {
      const { rightTabMpt: _dropped, ...attrs } = block.attrs
      block.attrs = attrs
    }
    blocks.set(node, block)
  }
  return block
}

export function toDocument(doc: Node): Document {
  let document = documents.get(doc)
  if (!document) {
    const content: BlockJson[] = []
    doc.forEach((node) => content.push(blockJson(node)))
    document = {
      type: "doc",
      attrs: doc.attrs,
      content,
    } as unknown as Document
    documents.set(doc, document)
  }
  return document
}

export function fromDocument(document: Document): Node {
  const parsed = documentSchema.parse(document)
  const doc = paperSchema.nodeFromJSON(parsed)
  doc.check()
  return doc
}

export function invariantProblem(doc: Node): string | null {
  try {
    doc.check()
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  const result = documentSchema.safeParse(toDocument(doc))
  if (result.success) return null
  return result.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ")
}
