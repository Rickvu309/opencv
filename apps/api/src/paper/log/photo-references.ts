import type { Document } from "@workspace/domain/paper-doc"

export function photoReferences(doc: Document): string[] {
  const ids = new Set<string>()
  for (const block of doc.content)
    if (block.type === "image") ids.add(block.attrs.fileId)
  return [...ids].sort()
}

export function releasedPhotos(before: Document, after: Document): string[] {
  const kept = new Set(photoReferences(after))
  return photoReferences(before).filter((id) => !kept.has(id))
}
