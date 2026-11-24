import { createHash } from "node:crypto"

import {
  ERROR_CODES,
  canonicalPaper,
  nativeAdmission,
  nativeProvenance,
  sameNativeProvenance,
  type NativeBasis,
  type NativeWriter,
  type PaperDocument,
  type StoredPaperDocument,
} from "@workspace/domain"

import { CommandError } from "../platform/errors.js"

export function admitDocument(
  document: StoredPaperDocument,
  writer?: NativeWriter
) {
  if (document.version === 3) return
  const refusal = nativeAdmission(document, writer)
  if (refusal) throw new CommandError(ERROR_CODES.CONFLICT, refusal)
}

export function basisOf(
  document: PaperDocument,
  epoch: number,
  revision: number
): (NativeBasis & { provenance: { schemaRevision: 1 } }) | undefined {
  if (document.version === 3) return undefined
  return {
    provenance: nativeProvenance(document),
    epoch,
    revision,
    digest: createHash("sha256").update(canonicalPaper(document)).digest("hex"),
  }
}

export function admitBasis(
  document: PaperDocument,
  epoch: number,
  revision: number,
  basis?: NativeBasis
) {
  if (document.version === 3) {
    if (basis)
      throw new CommandError(
        ERROR_CODES.CONFLICT,
        "This proposal belongs to a different document schema. Read the document again."
      )
    return
  }
  const expected = basisOf(document, epoch, revision)
  if (
    !basis ||
    !expected ||
    basis.epoch !== expected.epoch ||
    basis.revision !== expected.revision ||
    basis.digest !== expected.digest ||
    !sameNativeProvenance(basis.provenance, expected.provenance)
  )
    throw new CommandError(
      ERROR_CODES.CONFLICT,
      "This proposal belongs to an earlier document state or schema. Read the document again."
    )
}
