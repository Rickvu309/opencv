import { docToBlocks } from "@blocknote/core"
import type { Node } from "@tiptap/pm/model"
import type { EditorState, Transaction } from "@tiptap/pm/state"
import type {
  FormatNode,
  PrivateFormattedDocument,
} from "@workspace/domain/internal/paper-presentation"
import { fromFormattingBlocks } from "./native-formatting-cv.js"
import { readPresentationMeta } from "./presentation-meta.js"
import type { EngineBinding } from "./presentation-binding.js"

function fields(document: PrivateFormattedDocument) {
  const result = new Map<string, { owner: string; identity: string }>()
  const owners = new Set<string>()
  function visit(node: FormatNode) {
    if (node.type === "cvField") {
      if (node.content.some((run) => /[\r\n]/.test(run.text)))
        throw new Error("CV fields are single line")
      result.set(node.id, {
        owner: node.ownerId,
        identity: JSON.stringify([node.ownerId, node.fieldKey, node.itemId]),
      })
    } else if ("children" in node) {
      if (!["bullet", "numbered"].includes(node.type)) owners.add(node.id)
      node.children.forEach(visit)
    }
  }
  if (document.kind === "cv") visit(document.header)
  document.blocks.forEach(visit)
  return { fields: result, owners }
}

function fieldSelection(state: EditorState): boolean {
  for (let depth = state.selection.$from.depth; depth > 0; depth--)
    if (state.selection.$from.node(depth).type.name === "paperCvField")
      return true
  return false
}

function topology(doc: Node): string {
  const nodes: unknown[] = []
  doc.descendants((node) => {
    if (node.type.name === "blockContainer") nodes.push(node.attrs.id)
  })
  return JSON.stringify(nodes)
}

export function acceptsFormattingTransaction(
  binding: EngineBinding,
  initial: PrivateFormattedDocument,
  tr: Transaction,
  state: EditorState
): boolean {
  if (!tr.docChanged) return true
  try {
    const presentation = readPresentationMeta(binding.doc)
    const after = fromFormattingBlocks(
      docToBlocks(tr.doc),
      binding.kind,
      presentation
    )
    let before = initial
    try {
      before = fromFormattingBlocks(
        docToBlocks(state.doc),
        binding.kind,
        presentation
      )
    } catch {
      before = initial
    }
    const old = fields(before),
      next = fields(after)
    for (const [id, field] of old.fields) {
      if (!next.owners.has(field.owner)) continue
      if (next.fields.get(id)?.identity !== field.identity) return false
    }
    for (const [id, field] of next.fields) {
      if (!old.owners.has(field.owner)) continue
      if (old.fields.get(id)?.identity !== field.identity) return false
    }
    if (fieldSelection(state) && topology(tr.doc) !== topology(state.doc))
      return false
    return true
  } catch {
    return false
  }
}
