import {
  ERROR_CODES,
  storedPaperDocumentSchema,
  requirePaperDocument,
  type StoredPaperDocument,
  type PaperDocument,
  type PaperStoredKind,
} from "@workspace/domain"
import { materializeStored, seedStoredYDoc } from "@workspace/paper-crdt"
import { CommandError } from "../registry/errors.js"

function invalidDocument(message: string) {
  return new CommandError(ERROR_CODES.VALIDATION_ERROR, message)
}

export function validatedStored(
  candidate: unknown,
  kind: PaperStoredKind
): StoredPaperDocument {
  const parsed = storedPaperDocumentSchema.safeParse(candidate)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw invalidDocument(issue?.message ?? "The document is not valid")
  }
  if (parsed.data.kind !== kind) {
    throw invalidDocument(`A ${kind} cannot hold a ${parsed.data.kind}`)
  }
  return parsed.data
}

export function validated(
  candidate: unknown,
  kind: PaperStoredKind
): PaperDocument {
  try {
    return requirePaperDocument(validatedStored(candidate, kind))
  } catch (error) {
    if (error instanceof CommandError) throw error
    throw new CommandError(
      ERROR_CODES.CONFLICT,
      error instanceof Error
        ? error.message
        : "This document needs a newer editor"
    )
  }
}

export function seedColumns(kind: PaperStoredKind, paper: StoredPaperDocument) {
  const seeded = validatedStored(paper, kind)
  let base: Uint8Array
  try {
    base = seedStoredYDoc(seeded)
  } catch (error) {
    throw invalidDocument(
      error instanceof Error ? error.message : "Cannot seed"
    )
  }
  const materialized = materializeStored(base)
  if (!materialized.ok) throw invalidDocument(materialized.reason)
  return {
    crdtEpoch: 1,
    crdtBase: Buffer.from(base),
    crdtDocument: validatedStored(
      materialized.document,
      kind
    ) as unknown as Record<string, unknown>,
  }
}

export function sameDocumentIdentity(
  current: StoredPaperDocument,
  candidate: StoredPaperDocument
) {
  if (
    current.kind !== candidate.kind ||
    current.version !== candidate.version ||
    (current.version === 4 &&
      (candidate.version !== 4 ||
        current.schemaRevision !== candidate.schemaRevision))
  )
    throw invalidDocument(
      "The candidate belongs to a different document schema"
    )
}
