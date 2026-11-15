import { docToBlocks } from "@blocknote/core"
import type { EditorState, Transaction } from "@tiptap/pm/state"
import type { ResolvedPos } from "@tiptap/pm/model"
import type {
  LayoutDocument,
  FormatNode,
  LayoutPhoto,
  LayoutTable,
  LayoutRow,
  LayoutCell,
} from "@workspace/domain/internal/paper-presentation"
import { canonical } from "@workspace/domain/internal/paper-presentation"
import { fromLayoutBlocks } from "./native-layout-codec.js"
import { readLayout, type LayoutBinding } from "./native-layout.js"
import { readPresentationMeta } from "./presentation-meta.js"

export function layoutCellAt(
  position: Pick<ResolvedPos, "depth" | "node">
): string | null {
  for (let depth = position.depth; depth > 0; depth--)
    if (position.node(depth).type.name === "paperCell")
      return position.node(depth).attrs.id
  return null
}
function identities(document: LayoutDocument) {
  const owners = new Map<string, string | null>(),
    fields = new Map<string, string>(),
    grid: unknown[] = [],
    photos: unknown[] = []
  function visit(
    node: FormatNode | LayoutPhoto | LayoutTable | LayoutRow | LayoutCell,
    parent: string,
    cell: string | null
  ) {
    if (["table", "row", "cell"].includes(node.type))
      grid.push([
        node.id,
        node.type,
        parent,
        node.type === "table"
          ? node.columns
          : node.type === "cell"
            ? node.columnId
            : null,
      ])
    if (node.type === "cell") cell = node.id
    owners.set(node.id, cell)
    if (node.type === "photo") photos.push([parent, node])
    if (node.type === "cvField")
      fields.set(node.id, canonical([node.ownerId, node.fieldKey, node.itemId]))
    if ("children" in node)
      node.children.forEach((child) => visit(child, node.id, cell))
  }
  document.flow.children.forEach((node) => visit(node, document.flow.id, null))
  return {
    owners,
    fields,
    grid: canonical([document.flow.id, grid]),
    photos: canonical(photos),
  }
}
export function acceptsLayoutTransaction(
  binding: LayoutBinding,
  tr: Transaction,
  state: EditorState
): boolean {
  if (!tr.docChanged) return true
  try {
    const stored = readLayout(binding),
      presentation = readPresentationMeta(binding.doc)
    const after = fromLayoutBlocks(
      docToBlocks(tr.doc),
      binding.kind,
      presentation,
      stored.profile
    )
    if (canonical(after) === canonical(stored)) return true
    const before = fromLayoutBlocks(
      docToBlocks(state.doc),
      binding.kind,
      presentation,
      stored.profile
    )
    const old = identities(before),
      next = identities(after)
    if (
      old.grid !== next.grid ||
      old.photos !== next.photos ||
      layoutCellAt(state.selection.$from) !== layoutCellAt(state.selection.$to)
    )
      return false
    for (const [id, cell] of old.owners)
      if (next.owners.has(id) && next.owners.get(id) !== cell) return false
    for (const [id, identity] of old.fields)
      if (next.fields.get(id) !== identity) return false
    for (const [id, identity] of next.fields)
      if (old.fields.get(id) !== identity) return false
    const beforeOrder = before.flow.children
      .filter((node) => next.owners.has(node.id))
      .map((node) => node.id)
    const afterOrder = after.flow.children
      .filter((node) => old.owners.has(node.id))
      .map((node) => node.id)
    return canonical(beforeOrder) === canonical(afterOrder)
  } catch {
    return false
  }
}
