import {
  canonicalPaper,
  richPaperDocumentSchema,
  storedPaperDocumentSchema,
  type StoredPaperDocument,
} from "@workspace/domain/paper-doc"
import * as Y from "yjs"
import { flowReceiptSchema } from "@workspace/domain/internal/paper-presentation"
import {
  createPrivateFlow,
  openFlowBinary,
  readFlow,
} from "./native-layout-flow.js"

export type StoredDocumentResult =
  | { readonly ok: true; readonly document: StoredPaperDocument }
  | { readonly ok: false; readonly reason: string }

export function seedStoredYDoc(input: StoredPaperDocument): Uint8Array {
  const document = storedPaperDocumentSchema.parse(input)
  const { version, schemaRevision, ...flow } = document
  const result = createPrivateFlow(flow)
  if (result.kind === "refused") throw new Error(result.reason)
  const binding = result.value
  try {
    const meta = binding.doc.getMap<unknown>("paper")
    meta.set("version", version)
    meta.set("schemaRevision", schemaRevision)
    meta.set("kind", document.kind)
    const bytes = Y.encodeStateAsUpdate(binding.doc)
    const roundtrip = materializeStored(bytes)
    if (!roundtrip.ok) throw new Error(roundtrip.reason)
    if (canonicalPaper(roundtrip.document) !== canonicalPaper(document))
      throw new Error("The stored editor changed the document")
    return bytes
  } finally {
    binding.engine._tiptapEditor.destroy()
    binding.doc.destroy()
  }
}

export function materializeStored(
  source: Uint8Array | Y.Doc
): StoredDocumentResult {
  const doc = new Y.Doc()
  try {
    Y.applyUpdate(
      doc,
      source instanceof Y.Doc ? Y.encodeStateAsUpdate(source) : source
    )
    const meta = doc.getMap<unknown>("paper")
    const revision = meta.get("schemaRevision")
    const profile = meta.get("formattingProfile")
    if (
      meta.get("version") !== 4 ||
      revision !== 2 ||
      profile !== "private-layout-3"
    )
      throw new Error("Unsupported rich document identity")
    const kind = meta.get("kind")
    if (kind !== "cv" && kind !== "letter")
      throw new Error("Invalid rich document kind")
    const fragment =
      kind === "cv" ? "private-native-cv-v4-r2" : "document-store"
    for (const root of doc.share.keys())
      if (root !== "paper" && root !== fragment)
        throw new Error("Unknown or competing document root")
    for (const [key, value] of meta.entries()) {
      if (
        [
          "version",
          "schemaRevision",
          "kind",
          "formattingProfile",
          "private-presentation",
        ].includes(key)
      )
        continue
      if (!/^flow-receipt:[A-Za-z0-9_-]{1,64}$/.test(key))
        throw new Error("Unknown rich document metadata")
      if (
        !value ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        Object.keys(value).some(
          (field) => !["request", "receipt", "undone"].includes(field)
        ) ||
        !("request" in value) ||
        typeof value.request !== "string" ||
        !("undone" in value) ||
        typeof value.undone !== "boolean" ||
        !("receipt" in value)
      )
        throw new Error("Invalid rich edit receipt")
      const receipt = flowReceiptSchema.parse(value.receipt)
      if (receipt.kind !== kind)
        throw new Error("Receipt belongs to another document kind")
    }
    const binding = openFlowBinary(Y.encodeStateAsUpdate(doc), kind)
    try {
      const document = richPaperDocumentSchema.parse({
        ...readFlow(binding),
        version: 4,
        schemaRevision: 2,
      })
      return { ok: true, document }
    } finally {
      binding.engine._tiptapEditor.destroy()
      binding.doc.destroy()
    }
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof Error ? error.message : "Cannot read stored document",
    }
  } finally {
    doc.destroy()
  }
}
