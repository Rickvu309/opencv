import { createHash } from "node:crypto"
import {
  ERROR_CODES,
  canonicalPaper,
  nativeProvenance,
  richPaperDocumentSchema,
  type NativeWriter,
  type RichPaperDocument,
} from "@workspace/domain"
import { materializeStored, writeStoredYDoc } from "@workspace/paper-crdt"
import { CommandError } from "../registry/errors.js"
import { sameDocumentIdentity, validatedStored } from "./content-document.js"
import type { Live, PaperRow } from "./content-types.js"
import { admitDocument } from "./native-admission.js"

export type RichContentChange = {
  origin: "coach" | "revert"
  editId: string
  touched: string[]
}
export type RichContent = ReturnType<typeof richContent>

export function richContent(row: PaperRow, entry: Live, writer: NativeWriter) {
  const document = richPaperDocumentSchema.parse(
    validatedStored(row.crdtDocument, row.kind)
  )
  admitDocument(document, writer)
  if (!row.crdtBase || !row.crdtEpoch)
    throw new CommandError(
      ERROR_CODES.VALIDATION_ERROR,
      "The saved document has no editing basis"
    )
  const materialized = materializeStored(entry.yDoc)
  if (
    !materialized.ok ||
    canonicalPaper(materialized.document) !== canonicalPaper(document)
  )
    throw new CommandError(
      ERROR_CODES.VALIDATION_ERROR,
      "The saved document and its editing history disagree"
    )
  return {
    document,
    basis: {
      provenance: nativeProvenance(document),
      epoch: entry.epoch,
      revision: entry.revision,
      digest: createHash("sha256")
        .update(canonicalPaper(document))
        .digest("hex"),
    },
    write(target: RichPaperDocument) {
      sameDocumentIdentity(document, target)
      return writeStoredYDoc(entry.yDoc, target)
    },
  }
}
