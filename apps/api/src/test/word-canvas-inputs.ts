import type { WordBatch } from "@workspace/domain"

import { open } from "../paper/word/document.js"

export function writeInput(
  doc: string,
  basedOn: string,
  ops: WordBatch["ops"]
): { op: "write"; batch: WordBatch } {
  return { op: "write", batch: { doc, basedOn, ops } }
}

async function linesAt(owner: string, doc: string, at: string) {
  const page = await open(owner, { kind: "read", doc, at })
  if ("refused" in page) throw new Error(page.message)
  return page.paragraphs
}

export async function splitInput(
  owner: string,
  doc: string,
  basedOn: string,
  handle: string,
  at: number
) {
  const line = (await linesAt(owner, doc, basedOn)).find(
    (paragraph) => paragraph.handle === handle
  )
  const letters = [...(line?.text ?? "")]
  return writeInput(doc, basedOn, [
    { op: "setText", handle, text: letters.slice(0, at).join("") },
    { op: "insert", after: handle, text: letters.slice(at).join("") },
  ])
}

export async function mergeInput(
  owner: string,
  doc: string,
  basedOn: string,
  handle: string
) {
  const lines = await linesAt(owner, doc, basedOn)
  const at = lines.findIndex((paragraph) => paragraph.handle === handle)
  const kept = lines[at - 1]
  if (!kept) throw new Error("No line before this one")
  return writeInput(doc, basedOn, [
    { op: "setText", handle: kept.handle, text: kept.text + lines[at]!.text },
    { op: "delete", handle },
  ])
}
