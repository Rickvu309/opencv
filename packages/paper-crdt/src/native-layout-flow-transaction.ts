import { docToBlocks } from "@blocknote/core"
import type { EditorState, Transaction } from "@tiptap/pm/state"
import {
  canonical,
  type FlowDocument,
} from "@workspace/domain/internal/paper-presentation"
import { readFlow, type FlowBinding } from "./native-layout-flow.js"
import { readFlowBlocks } from "./native-layout-flow-codec.js"
import { layoutCellAt, layoutIdentities } from "./native-layout-transaction.js"
import { readPresentationMeta } from "./presentation-meta.js"

function identities(document: FlowDocument) {
  const content = document.flow.children.flatMap((section) =>
    section.children.filter((node) => node.type !== "pageBreak")
  )
  const sections = document.flow.children.map(
    ({ id, start, page, columns, children }) => ({
      id,
      start,
      page,
      columns,
      breaks: children
        .filter((node) => node.type === "pageBreak")
        .map((node) => node.id),
    })
  )
  return {
    ...layoutIdentities({ flow: { ...document.flow, children: content } }),
    sections: canonical(sections),
    parents: new Map(
      document.flow.children.flatMap((section) =>
        section.children.map((node) => [node.id, section.id])
      )
    ),
  }
}
export function acceptsFlowTransaction(
  binding: FlowBinding,
  tr: Transaction,
  state: EditorState
): boolean {
  if (!tr.docChanged) return true
  try {
    const stored = readFlow(binding),
      presentation = readPresentationMeta(binding.doc)
    const after = readFlowBlocks(
      docToBlocks(tr.doc),
      binding.kind,
      presentation
    )
    if (canonical(after) === canonical(stored)) return true
    const before = readFlowBlocks(
      docToBlocks(state.doc),
      binding.kind,
      presentation
    )
    const old = identities(before),
      next = identities(after)
    if (
      old.sections !== next.sections ||
      old.grid !== next.grid ||
      old.photos !== next.photos ||
      layoutCellAt(state.selection.$from) !== layoutCellAt(state.selection.$to)
    )
      return false
    for (const [id, cell] of old.owners)
      if (next.owners.has(id) && next.owners.get(id) !== cell) return false
    for (const [id, section] of old.parents)
      if (next.parents.has(id) && next.parents.get(id) !== section) return false
    for (const [id, field] of old.fields)
      if (next.fields.get(id) !== field) return false
    for (const [id, field] of next.fields)
      if (old.fields.get(id) !== field) return false
    const order = (document: FlowDocument, common: Map<string, string>) =>
      document.flow.children.flatMap((section) =>
        section.children
          .filter((node) => common.has(node.id))
          .map((node) => node.id)
      )
    return (
      canonical(order(before, next.parents)) ===
      canonical(order(after, old.parents))
    )
  } catch {
    return false
  }
}
