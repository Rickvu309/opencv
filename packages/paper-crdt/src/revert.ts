import * as Y from "yjs"

import { FRAGMENT } from "./names.js"

export type HistoryRow = {
  readonly update: Uint8Array
  readonly origin: string
}

type StackItem = Y.UndoManager["undoStack"][number]

function ownerOfDeletedAncestor(
  item: Y.Item,
  stack: readonly StackItem[]
): StackItem | undefined {
  let parent = item.parent
  while (parent instanceof Y.AbstractType && parent._item) {
    const ancestor: Y.Item = parent._item
    const owner = stack.find((entry) =>
      Y.isDeleted(entry.deletions, ancestor.id)
    )
    if (owner) return owner
    parent = ancestor.parent
  }
  return undefined
}

type Fresh = {
  readonly item: Y.Item
  readonly clock: number
  readonly len: number
}

function insertedSince(replay: Y.Doc, before: Map<number, number>): Fresh[] {
  const fresh: Fresh[] = []
  for (const [client, structs] of replay.store.clients) {
    const from = before.get(client) ?? 0
    for (const struct of structs) {
      const end = struct.id.clock + struct.length
      if (struct instanceof Y.Item && end > from) {
        const clock = Math.max(struct.id.clock, from)
        fresh.push({ item: struct, clock, len: end - clock })
      }
    }
  }
  return fresh
}

function adoptOrphans(manager: Y.UndoManager, fresh: readonly Fresh[]): void {
  let changed = true
  const adopted = new Set<Fresh>()
  while (changed) {
    changed = false
    for (const entry of fresh) {
      if (adopted.has(entry) || !entry.item.deleted) continue
      const owner = ownerOfDeletedAncestor(entry.item, manager.undoStack)
      if (!owner) continue
      const extra = Y.createDeleteSet()
      extra.clients.set(entry.item.id.client, [
        { clock: entry.clock, len: entry.len },
      ])
      owner.deletions = Y.mergeDeleteSets([owner.deletions, extra])
      adopted.add(entry)
      changed = true
    }
  }
}

function without(
  deletions: StackItem["deletions"],
  removed: StackItem["deletions"]
): StackItem["deletions"] {
  const result = Y.createDeleteSet()
  for (const [client, ranges] of deletions.clients) {
    const cuts = [...(removed.clients.get(client) ?? [])].sort(
      (a, b) => a.clock - b.clock
    )
    const kept: { clock: number; len: number }[] = []
    for (const range of ranges) {
      let start = range.clock
      const end = range.clock + range.len
      for (const cut of cuts) {
        const cutEnd = cut.clock + cut.len
        if (cutEnd <= start || cut.clock >= end) continue
        if (cut.clock > start) {
          kept.push({ clock: start, len: cut.clock - start })
        }
        start = Math.max(start, cutEnd)
      }
      if (start < end) kept.push({ clock: start, len: end - start })
    }
    if (kept.length > 0) result.clients.set(client, kept)
  }
  return result
}

function letOthersKeepTheirDeletes(
  manager: Y.UndoManager,
  row: HistoryRow
): void {
  const { ds } = Y.decodeUpdate(row.update)
  for (const entry of manager.undoStack) {
    entry.deletions = without(entry.deletions, ds)
  }
}

export type Range = { client: number; clock: number; len: number }

export function replayHistory(
  history: readonly HistoryRow[],
  editOrigin: string
) {
  const replay = new Y.Doc({ gc: false })
  const manager = new Y.UndoManager(replay.getXmlFragment(FRAGMENT), {
    trackedOrigins: new Set([editOrigin]),
    captureTimeout: 0,
  })
  const inserted: Range[] = []
  for (const row of history) {
    const before = Y.decodeStateVector(Y.encodeStateVector(replay))
    Y.applyUpdate(replay, row.update, row.origin)
    if (row.origin === editOrigin) {
      for (const struct of Y.decodeUpdate(row.update).structs) {
        if (struct instanceof Y.Item) {
          inserted.push({
            client: struct.id.client,
            clock: struct.id.clock,
            len: struct.length,
          })
        }
      }
    }
    if (row.origin !== editOrigin && manager.undoStack.length > 0) {
      adoptOrphans(manager, insertedSince(replay, before))
      letOthersKeepTheirDeletes(manager, row)
    }
  }
  return { replay, manager, inserted }
}

export function revertOrigin(
  history: readonly HistoryRow[],
  editOrigin: string
): Uint8Array | null {
  if (history.some((row) => row.origin === `revert:${editOrigin}`)) return null
  const { replay, manager } = replayHistory(history, editOrigin)
  const updates: Uint8Array[] = []
  replay.on("update", (update: Uint8Array) => updates.push(update))
  while (manager.canUndo()) manager.undo()
  return updates.length > 0 ? Y.mergeUpdates(updates) : null
}
