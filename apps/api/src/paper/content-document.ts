import {
  ERROR_CODES,
  paperDocumentSchema,
  type PaperDocument,
  type PaperStoredKind,
} from "@workspace/domain"
import { materialize, seedYDoc } from "@workspace/paper-crdt"
import { CommandError } from "../registry/errors.js"

function invalidDocument(message: string) {
  return new CommandError(ERROR_CODES.VALIDATION_ERROR, message)
}

export function validated(
  candidate: unknown,
  kind: PaperStoredKind
): PaperDocument {
  const parsed = paperDocumentSchema.safeParse(candidate)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw invalidDocument(issue?.message ?? "The document is not valid")
  }
  if (parsed.data.kind !== kind) {
    throw invalidDocument(`A ${kind} cannot hold a ${parsed.data.kind}`)
  }
  return parsed.data
}

export function seedColumns(kind: PaperStoredKind, paper: PaperDocument) {
  const seeded = validated(paper, kind)
  let base: Uint8Array
  try {
    base = seedYDoc(seeded)
  } catch (error) {
    throw invalidDocument(
      error instanceof Error ? error.message : "Cannot seed"
    )
  }
  const materialized = materialize(base)
  if (!materialized.ok) throw invalidDocument(materialized.reason)
  return {
    crdtEpoch: 1,
    crdtBase: Buffer.from(base),
    crdtDocument: validated(materialized.document, kind) as unknown as Record<
      string,
      unknown
    >,
  }
}
