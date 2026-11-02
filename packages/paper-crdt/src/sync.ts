import * as Y from "yjs"

export type PaperYDoc = Y.Doc

export type Absorbed =
  | { readonly ok: true; readonly effective: Uint8Array | null }
  | { readonly ok: false; readonly reason: string }

export function loadYDoc(
  base: Uint8Array | null,
  updates: readonly Uint8Array[]
): PaperYDoc {
  const yDoc = new Y.Doc()
  if (base) Y.applyUpdate(yDoc, base)
  for (const update of updates) Y.applyUpdate(yDoc, update)
  return yDoc
}

export function absorbUpdate(
  yDoc: PaperYDoc,
  update: Uint8Array,
  origin: string
): Absorbed {
  const seen: Uint8Array[] = []
  const collect = (bytes: Uint8Array) => seen.push(bytes)
  yDoc.on("update", collect)
  try {
    Y.applyUpdate(yDoc, update, origin)
  } catch {
    return { ok: false, reason: "The update could not be read" }
  } finally {
    yDoc.off("update", collect)
  }
  if (yDoc.store.pendingStructs || yDoc.store.pendingDs) {
    return { ok: false, reason: "The update needs changes the server lacks" }
  }
  if (seen.length === 0) return { ok: true, effective: null }
  return {
    ok: true,
    effective: seen.length === 1 ? seen[0]! : Y.mergeUpdates(seen),
  }
}

export function stateVectorOf(yDoc: PaperYDoc): Uint8Array {
  return Y.encodeStateVector(yDoc)
}

export function updateSince(
  yDoc: PaperYDoc,
  stateVector: Uint8Array
): Uint8Array | null {
  if (stateVector.length === 0) return Y.encodeStateAsUpdate(yDoc)
  try {
    return Y.encodeStateAsUpdate(yDoc, stateVector)
  } catch {
    return null
  }
}
