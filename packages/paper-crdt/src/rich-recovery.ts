import {
  sameNativeProvenance,
  type NativeProvenance,
} from "@workspace/domain/paper-doc"
import * as Y from "yjs"
import { openRichPaperClient, storedHasPending, type Stored } from "./client.js"

function load(...updates: Uint8Array[]) {
  const doc = new Y.Doc({ gc: false })
  try {
    for (const update of updates) Y.applyUpdate(doc, update)
    return doc
  } catch (error) {
    doc.destroy()
    throw error
  }
}

function contains(whole: Y.Doc, part: Y.Doc) {
  const vector = Y.decodeStateVector(Y.encodeStateVector(whole))
  for (const [client, clock] of Y.decodeStateVector(Y.encodeStateVector(part)))
    if ((vector.get(client) ?? 0) < clock) return false
  const deleted = Y.createDeleteSetFromStructStore(whole.store)
  for (const [client, ranges] of Y.createDeleteSetFromStructStore(part.store)
    .clients)
    for (const range of ranges)
      for (let clock = range.clock; clock < range.clock + range.len; clock += 1)
        if (!Y.isDeleted(deleted, Y.createID(client, clock))) return false
  return true
}

export function recoverRichPaperClient(
  admitted: Stored,
  checkpoints: readonly Stored[],
  provenance: NativeProvenance
) {
  const admittedClient = openRichPaperClient(admitted, { provenance })
  const retained: Y.Doc[] = []
  try {
    if (admittedClient.hasPending())
      throw new Error("The admitted document contains unacknowledged input")
    const server = load(admitted.server)
    retained.push(server)
    let selected = server
    for (const checkpoint of checkpoints) {
      if (!sameNativeProvenance(checkpoint.provenance, provenance))
        throw new Error("Recovery schema changed. The original bytes are kept.")
      const candidate = openRichPaperClient(checkpoint, { provenance })
      try {
        if (!storedHasPending(checkpoint)) continue
        if (
          checkpoint.epoch !== admitted.epoch ||
          (checkpoint.revision ?? 0) > (admitted.revision ?? 0)
        )
          throw new Error(
            "Recovery basis changed. The original bytes are kept."
          )
        const base = load(checkpoint.server)
        retained.push(base)
        if (!contains(server, base))
          throw new Error(
            "Recovery basis is missing. The original bytes are kept."
          )
        if (contains(server, candidate.ydoc)) continue
        if (!contains(candidate.ydoc, server))
          throw new Error(
            "Recovery conflicts with saved edits. Both drafts are kept."
          )
        if (contains(selected, candidate.ydoc)) continue
        if (!contains(candidate.ydoc, selected))
          throw new Error("Recovery drafts diverged. Both drafts are kept.")
        selected = load(candidate.state())
        retained.push(selected)
      } finally {
        candidate.destroy()
      }
    }
    return openRichPaperClient(
      {
        ...admitted,
        pending: Y.encodeStateAsUpdate(selected, Y.encodeStateVector(server)),
      },
      { provenance }
    )
  } finally {
    admittedClient.destroy()
    for (const doc of retained) doc.destroy()
  }
}
