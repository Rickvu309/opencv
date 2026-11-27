import type { Node } from "prosemirror-model"
import { documentSchema, type Document } from "@workspace/domain/paper-doc"

import { paperSchema } from "./schema.js"

const documents = new WeakMap<Node, Document>()

type BlockJson = { type: string; attrs?: Record<string, unknown> }

export function toDocument(doc: Node): Document {
  let document = documents.get(doc)
  if (!document) {
    const json = doc.toJSON() as { content: BlockJson[] }
    for (const block of json.content) {
      if (block.type === "text_block" && block.attrs?.rightTabMpt === null) {
        const { rightTabMpt: _dropped, ...attrs } = block.attrs
        block.attrs = attrs
      }
    }
    document = json as unknown as Document
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
