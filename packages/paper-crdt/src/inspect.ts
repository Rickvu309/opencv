import * as Y from "yjs"

import { FRAGMENT } from "./names.js"
import {
  replayHistory,
  without,
  type HistoryRow,
  type Range,
} from "./revert.js"
import { materialize } from "./ydoc.js"
import type { PaperResult } from "./mapping.js"

export type EditReading = {
  readonly reverted: PaperResult
  readonly stripped: PaperResult
  readonly broken: ReadonlySet<string>
}

type Struct = {
  id: { client: number; clock: number }
  length: number
  content?: { str?: string }
}

function structsOf(update: Uint8Array): Struct[] {
  return (Y.decodeUpdate(update).structs as unknown as Struct[]).filter(
    (struct) => struct.content !== undefined
  )
}

function itemAt(doc: Y.Doc, client: number, clock: number): Y.Item | null {
  const found = Y.getItem(doc.store, Y.createID(client, clock)) as unknown
  return found instanceof Y.Item ? found : null
}

export function aliveCharacters(
  doc: Y.Doc,
  updates: readonly Uint8Array[]
): Set<string> {
  const alive = new Set<string>()
  for (const update of updates) {
    for (const struct of structsOf(update)) {
      if (typeof struct.content?.str !== "string") continue
      for (let i = 0; i < struct.length; i += 1) {
        const item = itemAt(doc, struct.id.client, struct.id.clock + i)
        if (item && !item.deleted) {
          alive.add(`${struct.id.client}:${struct.id.clock + i}`)
        }
      }
    }
  }
  return alive
}

export function lostCharacters(
  doc: Y.Doc,
  before: ReadonlySet<string>
): string[] {
  return [...before].filter((key) => {
    const [client, clock] = key.split(":").map(Number)
    const item = itemAt(doc, client!, clock!)
    return item === null || item.deleted
  })
}

type Structs = { id: { clock: number }; length: number }[]

function overlapsGarbage(
  live: Y.Doc,
  client: number,
  clock: number,
  len: number
) {
  const structs = live.store.clients.get(client) as unknown as
    (Structs[number] & { constructor: unknown })[] | undefined
  if (!structs) return false
  let low = 0
  let high = structs.length - 1
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    if (structs[mid]!.id.clock <= clock) low = mid
    else high = mid - 1
  }
  for (let at = low; at < structs.length; at += 1) {
    const struct = structs[at]!
    if (struct.id.clock >= clock + len) break
    if (struct.id.clock + struct.length <= clock) continue
    if (!(struct instanceof Y.Item)) return true
  }
  return false
}

export function landedInDeadContent(live: Y.Doc, update: Uint8Array): boolean {
  const decoded = Y.decodeUpdate(update)
  const inserted = (decoded.structs as unknown as Struct[]).some(
    (struct) =>
      struct.content !== undefined &&
      overlapsGarbage(live, struct.id.client, struct.id.clock, struct.length)
  )
  if (inserted) return true
  for (const [client, ranges] of decoded.ds.clients) {
    for (const range of ranges) {
      if (overlapsGarbage(live, client, range.clock, range.len)) return true
    }
  }
  return false
}

export function mergedUpdate(updates: readonly Uint8Array[]): Uint8Array {
  return Y.mergeUpdates([...updates])
}

function textOwner(item: Y.Item): string | null {
  let parent: unknown = item.parent
  while (parent instanceof Y.AbstractType) {
    if (parent instanceof Y.XmlElement) {
      const mark = parent._map.get("id")
      const value = mark?.content.getContent().at(-1)
      if (typeof value === "string") return value
    }
    parent = (parent as Y.AbstractType<unknown>)._item?.parent
  }
  return null
}

function aliveBlocks(doc: Y.Doc): Set<string> {
  const ids = new Set<string>()
  const visit = (node: Y.XmlFragment | Y.XmlElement) => {
    for (const child of node.toArray()) {
      if (!(child instanceof Y.XmlElement)) continue
      const id = child.getAttribute("id")
      if (typeof id === "string") ids.add(id)
      visit(child)
    }
  }
  visit(doc.getXmlFragment(FRAGMENT))
  return ids
}

function forEachItem(
  doc: Y.Doc,
  ranges: readonly Range[],
  visit: (item: Y.Item) => void
) {
  for (const range of ranges) {
    for (let at = range.clock; at < range.clock + range.len;) {
      const item = itemAt(doc, range.client, at)
      if (!item) break
      visit(item)
      at = item.id.clock + item.length
    }
  }
}

export function readEdit(
  history: readonly HistoryRow[],
  editOrigin: string
): EditReading | null {
  if (history.some((row) => row.origin === `revert:${editOrigin}`)) return null
  const { replay, manager, inserted } = replayHistory(history, editOrigin)
  const alive = aliveBlocks(replay)
  const broken = new Set<string>()
  forEachItem(replay, inserted, (item) => {
    if (!item.deleted || !(item.content as { str?: string }).str) return
    const owner = textOwner(item)
    if (owner && alive.has(owner)) broken.add(owner)
  })
  const clone = new Y.Doc({ gc: false })
  Y.applyUpdate(clone, Y.encodeStateAsUpdate(replay))
  clone.transact((transaction) => {
    forEachItem(clone, inserted, (item) => {
      if (!item.deleted && (item.content as { str?: string }).str) {
        item.delete(transaction)
      }
    })
  })
  const stripped = materialize(clone)
  while (manager.canUndo()) manager.undo()
  return { reverted: materialize(replay), stripped, broken }
}

export type RowInfo = { readonly update: Uint8Array; readonly person: boolean }

export type DeadReading = {
  readonly before: PaperResult
  readonly after: PaperResult
  readonly owners: Set<string>
}

type DeleteSet = ReturnType<typeof Y.createDeleteSet>

type DeadTop = { itemId: Y.ID; death: number; explicit: boolean }

function elementId(element: Y.XmlElement): string | null {
  const value = element._map.get("id")?.content.getContent().at(-1)
  return typeof value === "string" ? value : null
}

function deadAncestors(item: Y.Item, before: Y.Doc): Y.XmlElement[] {
  const dead: Y.XmlElement[] = []
  let parent: unknown = item.parent
  while (parent instanceof Y.AbstractType) {
    if (parent instanceof Y.XmlElement && parent._item) {
      const was = itemAt(before, parent._item.id.client, parent._item.id.clock)
      if (was?.deleted) dead.push(parent)
    }
    parent = (parent as Y.AbstractType<unknown>)._item?.parent
  }
  return dead
}

function subtreeItems(element: Y.XmlElement): Y.Item[] {
  const items: Y.Item[] = []
  const visit = (type: Y.AbstractType<unknown>) => {
    for (let item = type._start; item; item = item.right) {
      items.push(item)
      const content = item.content as { type?: Y.AbstractType<unknown> }
      if (content.type) visit(content.type)
    }
    type._map.forEach((item) => {
      for (let at: Y.Item | null = item; at; at = at.left) {
        items.push(at)
        const content = at.content as { type?: Y.AbstractType<unknown> }
        if (content.type) visit(content.type)
      }
    })
  }
  visit(element as unknown as Y.AbstractType<unknown>)
  return items
}

function deletedBy(ds: DeleteSet, id: Y.ID) {
  return Y.isDeleted(ds, id)
}

function viewOf(
  doc: Y.Doc,
  tops: readonly DeadTop[],
  rowDs: readonly DeleteSet[],
  rows: readonly RowInfo[],
  update: { ds: DeleteSet } | null
): { result: PaperResult; owners: Set<string> } {
  const revive = Y.createDeleteSet()
  const roots: Y.ID[] = []
  for (const top of tops) {
    const element = itemAt(doc, top.itemId.client, top.itemId.clock)
    const type = (element?.content as { type?: Y.XmlElement } | undefined)?.type
    if (!type) continue
    roots.push(top.itemId)
    const candidates = Y.createDeleteSet()
    for (const item of [element!, ...subtreeItems(type)]) {
      if (!item.deleted) continue
      const ranges = candidates.clients.get(item.id.client) ?? []
      ranges.push({ clock: item.id.clock, len: item.length })
      candidates.clients.set(item.id.client, ranges)
    }
    const stays = Y.mergeDeleteSets([
      ...rowDs.slice(0, top.death),
      ...rowDs.filter((_ds, k) => k > top.death && rows[k]!.person),
      ...(update !== null && top.explicit ? [update.ds] : []),
    ])
    const back = without(Y.mergeDeleteSets([candidates]), stays)
    for (const [client, ranges] of back.clients) {
      revive.clients.set(client, [
        ...(revive.clients.get(client) ?? []),
        ...ranges,
      ])
    }
  }
  const snapshot = Y.snapshot(doc)
  const shown = Y.createDocFromSnapshot(
    doc,
    new Y.Snapshot(without(snapshot.ds, revive), snapshot.sv),
    new Y.Doc({ gc: false })
  )
  const owners = new Set<string>()
  const topElements: Y.XmlElement[] = []
  for (const root of roots) {
    const element = itemAt(shown, root.client, root.clock)
    const type = (element?.content as { type?: Y.XmlElement } | undefined)?.type
    if (!type) continue
    topElements.push(type)
    const collect = (node: Y.XmlElement) => {
      for (const child of node.toArray()) {
        if (!(child instanceof Y.XmlElement)) continue
        const id = elementId(child)
        if (id) owners.add(id)
        collect(child)
      }
    }
    const own = elementId(type)
    if (own) owners.add(own)
    collect(type)
  }
  const dropTwins = (node: Y.XmlFragment | Y.XmlElement) => {
    const children = node.toArray()
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const child = children[index]
      if (!(child instanceof Y.XmlElement)) continue
      const id = elementId(child)
      const isTop = topElements.includes(child)
      const inside = topElements.some((top) => within(child, top))
      if (id && owners.has(id) && !isTop && !inside) {
        node.delete(index, 1)
      } else if (!inside) {
        dropTwins(child)
      }
    }
  }
  shown.transact(() => dropTwins(shown.getXmlFragment(FRAGMENT)))
  return { result: materialize(shown), owners }
}

function within(node: Y.XmlElement, top: Y.XmlElement): boolean {
  let parent: unknown = node
  while (parent instanceof Y.AbstractType) {
    if (parent === top) return true
    parent = (parent as Y.AbstractType<unknown>)._item?.parent
  }
  return false
}

export function readDeadBlocks(
  base: Uint8Array,
  rows: readonly RowInfo[],
  update: Uint8Array,
  live: Y.Doc
): DeadReading | null {
  const before = new Y.Doc({ gc: false })
  Y.applyUpdate(before, base)
  for (const row of rows) Y.applyUpdate(before, row.update)
  const after = new Y.Doc({ gc: false })
  Y.applyUpdate(after, Y.encodeStateAsUpdate(before))
  Y.applyUpdate(after, update)
  const decoded = Y.decodeUpdate(update)
  const rowDs = rows.map((row) => Y.decodeUpdate(row.update).ds)
  const triggers: Y.Item[] = []
  for (const struct of decoded.structs as unknown as Struct[]) {
    if (struct.content === undefined) continue
    if (
      !overlapsGarbage(live, struct.id.client, struct.id.clock, struct.length)
    )
      continue
    const item = itemAt(after, struct.id.client, struct.id.clock)
    if (item) triggers.push(item)
  }
  for (const [client, ranges] of decoded.ds.clients) {
    for (const range of ranges) {
      if (!overlapsGarbage(live, client, range.clock, range.len)) continue
      forEachItem(
        after,
        [{ client, clock: range.clock, len: range.len }],
        (item) => triggers.push(item)
      )
    }
  }
  const tops = new Map<string, DeadTop>()
  for (const item of triggers) {
    for (const top of deadAncestors(item, before)) {
      if (!top._item) continue
      const key = `${top._item.id.client}:${top._item.id.clock}`
      if (tops.has(key)) continue
      const death = rowDs.findIndex((ds) => deletedBy(ds, top._item!.id))
      if (death === -1) continue
      tops.set(key, {
        itemId: top._item.id,
        death,
        explicit: !deletedBy(decoded.ds, top._item.id),
      })
    }
  }
  if (tops.size === 0) return null
  const list = [...tops.values()]
  const was = viewOf(before, list, rowDs, rows, null)
  const now = viewOf(after, list, rowDs, rows, decoded)
  return {
    before: was.result,
    after: now.result,
    owners: new Set([...was.owners, ...now.owners]),
  }
}
