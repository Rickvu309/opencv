import * as Y from "yjs"

export const PENDING_CONTENT_ORIGIN = "paper-pending-content"

type Run = { insert: string; attributes?: Record<string, unknown> }
type Restoration = {
  position: Y.RelativePosition
  id: string
  runs: Run[]
}

function pendingRuns(text: Y.XmlText, vector: Map<number, number>): Run[] {
  const ranges: { start: number; end: number }[] = []
  let offset = 0
  for (let item = text._start; item; item = item.right) {
    if (item.deleted || !item.countable) continue
    const known = vector.get(item.id.client) ?? 0
    const start = Math.max(0, known - item.id.clock)
    if (start < item.length && item.content instanceof Y.ContentString)
      ranges.push({ start: offset + start, end: offset + item.length })
    offset += item.length
  }
  const runs: Run[] = []
  offset = 0
  for (const delta of text.toDelta()) {
    if (typeof delta.insert !== "string")
      throw new Error("Cannot recover nontext pending content")
    const end = offset + delta.insert.length
    for (const range of ranges) {
      const start = Math.max(offset, range.start)
      const stop = Math.min(end, range.end)
      if (stop > start)
        runs.push({
          insert: delta.insert.slice(start - offset, stop - offset),
          ...(delta.attributes ? { attributes: delta.attributes } : {}),
        })
    }
    offset = end
  }
  return runs
}

export function preservePendingContent(
  local: Y.Doc,
  server: Y.Doc,
  merged: Y.Doc
): Restoration[] {
  const vector = Y.decodeStateVector(Y.encodeStateVector(server))
  const deleted = Y.createDeleteSetFromStructStore(merged.store)
  const removed = (node: Y.XmlFragment | Y.XmlText) =>
    node._item !== null && Y.isDeleted(deleted, node._item.id)
  const restorations: Restoration[] = []
  const visit = (parent: Y.XmlFragment) => {
    for (const child of parent.toArray()) {
      if (child instanceof Y.XmlElement) visit(child)
      else if (child instanceof Y.XmlText) {
        let ancestor: Y.XmlFragment | Y.XmlText | null = child
        let lost = false
        let anchor: Y.RelativePosition | undefined
        while (ancestor) {
          lost ||= removed(ancestor)
          const group: Y.XmlFragment | null =
            ancestor.parent instanceof Y.XmlFragment ? ancestor.parent : null
          if (
            group instanceof Y.XmlElement &&
            group.nodeName === "paperFlowSection" &&
            !removed(group)
          ) {
            const index = group
              .toArray()
              .findIndex((child) => child === ancestor)
            anchor = Y.createRelativePositionFromTypeIndex(
              group,
              index + (removed(ancestor) ? 0 : 1)
            )
          }
          ancestor = group
        }
        if (!lost) continue
        const runs = pendingRuns(child, vector)
        if (!runs.length) continue
        if (!anchor) throw new Error("No surviving section for pending text")
        restorations.push({
          position: anchor,
          id: `pending-${local.clientID}-${Y.getState(local.store, local.clientID)}-${restorations.length}`,
          runs,
        })
      }
    }
  }
  for (const name of ["private-native-cv-v4-r2", "document-store"]) {
    if (local.share.has(name)) visit(local.getXmlFragment(name))
  }
  return restorations
}

export function restorePendingContent(doc: Y.Doc, plans: Restoration[]) {
  const targets = plans.map((plan) => {
    const target = Y.createAbsolutePositionFromRelativePosition(
      plan.position,
      doc
    )
    if (!target || !(target.type instanceof Y.XmlElement))
      throw new Error("Pending text position is no longer available")
    return { plan, target: { type: target.type, index: target.index } }
  })
  if (!targets.length) return
  doc.transact(() => {
    for (const { plan, target } of targets.reverse()) {
      const block = new Y.XmlElement("blockContainer")
      block.setAttribute("id", plan.id)
      const paragraph = new Y.XmlElement("paragraph")
      const text = new Y.XmlText()
      text.applyDelta(plan.runs)
      paragraph.insert(0, [text])
      block.insert(0, [paragraph])
      target.type.insert(target.index, [block])
    }
  }, PENDING_CONTENT_ORIGIN)
}
