import * as Y from "yjs"
import {
  documentPresentationSchema,
  type DocumentPresentation,
} from "@workspace/domain/internal/paper-presentation"
export const PRESENTATION_META = "private-presentation"
export const FORMATTING_PROFILE = "private-formatting-1"
export function readPresentationMeta(doc: Y.Doc): DocumentPresentation {
  const meta = doc.getMap<unknown>("paper").get(PRESENTATION_META)
  if (!(meta instanceof Y.Map))
    throw new Error("Missing canonical presentation map")
  return documentPresentationSchema.parse(meta.toJSON())
}
export function writePresentationMeta(
  doc: Y.Doc,
  value: DocumentPresentation
): void {
  const checked = documentPresentationSchema.parse(value)
  const root = doc.getMap<unknown>("paper")
  let nested = root.get(PRESENTATION_META)
  if (!(nested instanceof Y.Map)) {
    nested = new Y.Map<unknown>()
    root.set(PRESENTATION_META, nested)
  }
  if (!(nested instanceof Y.Map)) throw new Error("Invalid presentation map")
  for (const key of [...nested.keys()])
    if (!(key in checked)) nested.delete(key)
  for (const [key, item] of Object.entries(checked)) nested.set(key, item)
}
