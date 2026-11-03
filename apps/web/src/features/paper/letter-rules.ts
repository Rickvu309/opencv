import { createExtension } from "@blocknote/core"
import { Fragment, Slice, type Node, type ResolvedPos } from "prosemirror-model"
import { Plugin } from "prosemirror-state"
import { ySyncPluginKey } from "y-prosemirror"

export const LIST_ITEMS = new Set(["bulletListItem", "numberedListItem"])
const BODY_TYPES = new Set([
  "paragraph",
  "heading",
  "bulletListItem",
  "numberedListItem",
  "divider",
])
export const MAX_DEPTH = 3
export const HEADING_LEVELS = new Set([2, 3])

function countGroup(group: Node, depth: number): number {
  let found = 0
  group.forEach((container) => {
    if (container.childCount === 0) return
    const content = container.child(0)
    const kind = content.type.name
    if (depth > MAX_DEPTH) found += 1
    else if (depth > 1 && !LIST_ITEMS.has(kind)) found += 1
    else if (kind === "heading" && !HEADING_LEVELS.has(content.attrs.level)) {
      found += 1
    }
    if (container.childCount > 1) {
      found += LIST_ITEMS.has(kind)
        ? countGroup(container.child(1), depth + 1)
        : 1
    }
  })
  return found
}

export function letterViolations(doc: Node): number {
  return doc.childCount === 0 ? 0 : countGroup(doc.child(0), 1)
}

const LOOK_ATTRS = ["textAlignment", "textColor", "backgroundColor"]

export function resetLook(node: Node): Node {
  const attrs = { ...node.attrs }
  let changed = false
  for (const name of LOOK_ATTRS) {
    if (!(name in attrs)) continue
    const initial = node.type.spec.attrs?.[name]?.default
    if (attrs[name] === initial) continue
    attrs[name] = initial
    changed = true
  }
  return changed ? node.type.create(attrs, node.content, node.marks) : node
}

export function asParagraph(container: Node, content: Node): Node {
  const paragraph = container.type.schema.nodes.paragraph
  return container.type.create(container.attrs, [
    paragraph ? paragraph.create(null, content.content) : content,
  ])
}

export function asListItem(content: Node): Node {
  const bullet = content.type.schema.nodes.bulletListItem
  return bullet ? bullet.create(null, content.content, content.marks) : content
}

function coerceContainers(
  fragment: Fragment,
  depth: number,
  listOnly: boolean,
  into: Node[]
): void {
  fragment.forEach((node) => {
    if (node.type.name === "blockGroup") {
      coerceContainers(node.content, depth, listOnly, into)
      return
    }
    if (node.type.name !== "blockContainer" || node.childCount === 0) {
      into.push(node)
      return
    }
    const container = resetLook(node)
    let content = resetLook(container.child(0))
    if (!BODY_TYPES.has(content.type.name)) {
      const plain = asParagraph(container, content)
      into.push(
        listOnly
          ? container.type.create(container.attrs, [asListItem(plain.child(0))])
          : plain
      )
      return
    }
    if (listOnly && content.type.name === "divider") return
    if (listOnly && !LIST_ITEMS.has(content.type.name)) {
      content = asListItem(content)
    }
    if (
      content.type.name === "heading" &&
      !HEADING_LEVELS.has(content.attrs.level)
    ) {
      content = content.type.create(
        { ...content.attrs, level: content.attrs.level <= 2 ? 2 : 3 },
        content.content,
        content.marks
      )
    }
    const holdsList = LIST_ITEMS.has(content.type.name)
    const nested: Node[] = []
    const lifted: Node[] = []
    if (container.childCount > 1) {
      const found: Node[] = []
      coerceContainers(container.child(1).content, depth + 1, holdsList, found)
      for (const kid of found) {
        const kind = kid.childCount > 0 ? kid.child(0).type.name : ""
        const holds = holdsList && depth < MAX_DEPTH && LIST_ITEMS.has(kind)
        if (holds) nested.push(kid)
        else lifted.push(kid)
      }
    }
    const group = container.type.schema.nodes.blockGroup
    const kids = nested.length > 0 && group ? [group.create(null, nested)] : []
    into.push(container.type.create(container.attrs, [content, ...kids]))
    into.push(...lifted)
  })
}

export function coercePaste(slice: Slice, depth = 1): Slice {
  const out: Node[] = []
  coerceContainers(slice.content, depth, depth > 1, out)
  return new Slice(Fragment.from(out), slice.openStart, slice.openEnd)
}

export function insertionDepth(selectionFrom: ResolvedPos): number {
  let found = 0
  for (let level = selectionFrom.depth; level > 0; level -= 1) {
    if (selectionFrom.node(level).type.name === "blockContainer") found += 1
  }
  return Math.max(found, 1)
}

export const letterRulesPlugin = new Plugin({
  props: {
    transformPasted: (slice, view) =>
      coercePaste(slice, insertionDepth(view.state.selection.$from)),
  },
  filterTransaction(transaction, state) {
    if (!transaction.docChanged) return true
    if (transaction.getMeta(ySyncPluginKey)) return true
    return letterViolations(transaction.doc) <= letterViolations(state.doc)
  },
})

export const letterRulesExtension = createExtension({
  key: "letterRules",
  prosemirrorPlugins: [letterRulesPlugin],
})
