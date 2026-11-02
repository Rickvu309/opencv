import {
  paperDocumentSchema,
  plainTextOfRuns,
  type PaperDocument,
} from "@workspace/domain"
import * as Y from "yjs"

import { materialize, seedYDoc, type HistoryRow } from "../index.js"

export const header = {
  id: "header",
  type: "header",
  name: "Ada",
  email: "",
  phone: "",
  city: "",
  linkedin: "",
}

export function cv(blocks: unknown[]): PaperDocument {
  return paperDocumentSchema.parse({
    version: 3,
    kind: "cv",
    header,
    blocks,
    clashes: [],
  })
}

export function letter(blocks: unknown[]): PaperDocument {
  return paperDocumentSchema.parse({
    version: 3,
    kind: "letter",
    blocks,
    clashes: [],
  })
}

export const para = (id: string, content: unknown) => ({
  id,
  type: "paragraph",
  content,
})

export function snapshot(source: Y.Doc | Uint8Array): PaperDocument {
  const result = materialize(source)
  if (!result.ok) throw new Error(result.reason)
  return result.document
}

export function outline(document: PaperDocument): [string, string][] {
  return document.blocks.map((block) => [
    block.id,
    "content" in block && Array.isArray(block.content)
      ? plainTextOfRuns(block.content)
      : "",
  ])
}

export function room(base: PaperDocument) {
  const seed = seedYDoc(base)
  const live = new Y.Doc()
  Y.applyUpdate(live, seed, "seed")
  const history: HistoryRow[] = [{ update: seed, origin: "seed" }]
  const merge = (update: Uint8Array | null, origin: string) => {
    if (!update) throw new Error(`no update for ${origin}`)
    Y.applyUpdate(live, update, origin)
    history.push({ update, origin })
  }
  const fork = () => {
    const copy = new Y.Doc()
    Y.applyUpdate(copy, Y.encodeStateAsUpdate(live))
    return copy
  }
  return { live, history, merge, fork }
}
