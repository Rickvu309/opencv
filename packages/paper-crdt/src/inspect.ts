import * as Y from "yjs"

import { FRAGMENT } from "./names.js"
import { replayHistory, type HistoryRow, type Range } from "./revert.js"
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
