import { ERROR_CODES } from "@workspace/domain/kernel"
import {
  storedPaperDocumentSchema,
  type StoredPaperDocument,
  type PaperStoredKind,
} from "@workspace/domain/paper-doc"
import { materializeStored, seedStoredYDoc } from "@workspace/paper-crdt"
import { CommandError } from "../../platform/errors.js"

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
    engine: 1,
    crdtEpoch: 1,
    crdtBase: Buffer.from(base),
    crdtDocument: validatedStored(
      materialized.document,
      kind
    ) as unknown as Record<string, unknown>,
  }
}
