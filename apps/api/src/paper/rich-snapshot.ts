import { createHash } from "node:crypto"
import {
  ERROR_CODES,
  canonicalPaper,
  nativeProvenance,
  sameNativeProvenance,
  type RichPaperDocument,
  type NativeBasis,
} from "@workspace/domain"
import type { richExportInputSchema } from "@workspace/domain/operations/paper/export"
import { materializeStored } from "@workspace/paper-crdt"
import type { z } from "zod"
import { CommandError } from "../platform/errors.js"
import { validatedStored } from "./content-document.js"
import type { Live, PaperRow } from "./content-types.js"
import { admitDocument } from "./native-admission.js"

export type RichSnapshotInput = z.output<typeof richExportInputSchema>
export type RichSnapshot = {
  readonly docId: RichSnapshotInput["docId"]
  readonly name: string
  readonly kind: "cv" | "letter"
  readonly basis: NativeBasis
  readonly document: RichPaperDocument
}

function refuse() {
  return new CommandError(
    ERROR_CODES.CONFLICT,
    "This saved document no longer matches the download. Save and try again. Nothing was changed."
  )
}

export function qualifyRichDocument(
  row: PaperRow,
  input: RichSnapshotInput
): RichPaperDocument {
  const document = validatedStored(row.crdtDocument, row.kind)
  if (
    document.version !== 4 ||
    document.schemaRevision !== 2 ||
    document.kind !== input.kind
  )
    throw refuse()
  admitDocument(document, input.writer)
  if (
    !row.crdtBase ||
    !Number.isInteger(row.crdtEpoch) ||
    (row.crdtEpoch ?? 0) < 1 ||
    !Number.isInteger(row.crdtBaseSeq) ||
    (row.crdtBaseSeq ?? -1) < 0 ||
    (row.crdtBaseSeq ?? 0) > row.contentVersion
  )
    throw refuse()
  return document
}

export function qualifyRichSnapshot({
  row,
  entry,
  input,
  document,
}: {
  row: PaperRow
  entry: Live
  input: RichSnapshotInput
  document: RichPaperDocument
}): RichSnapshot {
  if (entry.epoch !== row.crdtEpoch || entry.revision !== row.contentVersion)
    throw refuse()
  const materialized = materializeStored(entry.yDoc)
  if (
    !materialized.ok ||
    canonicalPaper(materialized.document) !== canonicalPaper(document)
  )
    throw refuse()
  const basis = {
    provenance: nativeProvenance(document),
    epoch: entry.epoch,
    revision: entry.revision,
    digest: createHash("sha256").update(canonicalPaper(document)).digest("hex"),
  }
  if (
    !sameNativeProvenance(basis.provenance, input.basis.provenance) ||
    basis.epoch !== input.basis.epoch ||
    basis.revision !== input.basis.revision ||
    basis.digest !== input.basis.digest
  )
    throw refuse()
  return {
    docId: input.docId,
    name: row.name,
    kind: document.kind,
    basis,
    document,
  }
}
