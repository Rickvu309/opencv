import { createHash } from "node:crypto"

import {
  canonicalPaper,
  nativeProvenance,
  richTextNodes,
  type RichPaperDocument,
} from "@workspace/domain/paper-doc"

import { paperDocs } from "../db/schema.js"
import { readRichPaper } from "./content/read-paper.js"

type PaperRow = typeof paperDocs.$inferSelect

export const RICH_OUTLINE_MAX_CHARS = 200_000

export function richBasis(row: PaperRow, document: RichPaperDocument) {
  return {
    provenance: nativeProvenance(document),
    epoch: row.crdtEpoch ?? 0,
    revision: row.contentVersion,
    digest: createHash("sha256").update(canonicalPaper(document)).digest("hex"),
  }
}

export function richOutline(
  row: PaperRow,
  blockIds: readonly string[] | undefined
) {
  const document = readRichPaper(row)
  const selected = new Set(blockIds ?? [])
  const nodes = richTextNodes(document).map((node) => ({
    id: node.id,
    type: node.type,
    selected: selected.has(node.id),
    content: node.content,
  }))
  const outline = JSON.stringify(nodes)
  return {
    name: row.name,
    kind: row.kind,
    status: row.status,
    revision: row.contentVersion,
    nativeBasis: richBasis(row, document),
    outline:
      outline.length > RICH_OUTLINE_MAX_CHARS
        ? outline.slice(0, RICH_OUTLINE_MAX_CHARS)
        : outline,
    truncated: outline.length > RICH_OUTLINE_MAX_CHARS,
  }
}
