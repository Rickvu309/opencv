import {
  NATIVE_WRITER,
  nativeWriterSchema,
  nativeBasisSchema,
  nativeProvenance,
  nativeAdmission,
  sameNativeProvenance,
  paperQueries,
  type NativeWriter,
  type PaperView,
  type QueryOutput,
} from "@workspace/domain"

import { apiFetch } from "./api.ts"
import { unwrapData, type SuccessBody } from "./api-envelope.ts"

export type PaperQualification = {
  ownerId: string
  sessionId: string
  writer?: NativeWriter
  signal?: AbortSignal
}

type QualifiedRead = "paper.list" | "paper.get" | "paper.document"

export function paperWriter(options: PaperQualification) {
  return nativeWriterSchema.parse(options.writer ?? NATIVE_WRITER)
}

export function qualifiedPaperKey(
  prefix: readonly unknown[],
  options: PaperQualification
) {
  if (!options.ownerId || !options.sessionId)
    throw new Error("Qualified Paper reads need an owner and session scope")
  const writer = paperWriter(options)
  return [
    ...prefix,
    "native",
    options.ownerId,
    options.sessionId,
    writer,
  ] as const
}

function admitPaper(paper: PaperView["paper"], writer: NativeWriter) {
  if (paper.version !== 4) return
  const refusal = nativeAdmission(paper, writer)
  if (refusal) throw new Error(refusal)
}

function validateBasis(
  view: Pick<PaperView, "paper" | "nativeBasis" | "contentVersion">,
  writer: NativeWriter
) {
  if (view.paper.version !== 4) {
    if (view.nativeBasis)
      throw new Error("Legacy Paper cannot carry a native basis")
    return
  }
  admitPaper(view.paper, writer)
  const basis = nativeBasisSchema.parse(view.nativeBasis)
  if (
    basis.revision !== view.contentVersion ||
    !sameNativeProvenance(basis.provenance, nativeProvenance(view.paper))
  )
    throw new Error("Native Paper basis does not match the saved document")
}

export function qualifiedPaperRead(
  name: "paper.list",
  path: string,
  options: PaperQualification
): Promise<QueryOutput<"paper.list">>
export function qualifiedPaperRead(
  name: "paper.get",
  path: string,
  options: PaperQualification
): Promise<QueryOutput<"paper.get">>
export async function qualifiedPaperRead(
  name: "paper.document",
  path: string,
  options: PaperQualification
): Promise<QueryOutput<"paper.document">>
export async function qualifiedPaperRead(
  name: QualifiedRead,
  path: string,
  options: PaperQualification
) {
  const writer = paperWriter(options)
  qualifiedPaperKey([name], options)
  options.signal?.throwIfAborted()
  const payload = await apiFetch<SuccessBody<unknown>>(path, {
    headers: { "x-paper-writer": JSON.stringify(writer) },
    signal: options.signal,
  })
  options.signal?.throwIfAborted()
  const result = paperQueries[name].output.parse(unwrapData(payload))
  if (name === "paper.list") {
    const rows = paperQueries["paper.list"].output.parse(result)
    rows.forEach((row) => validateBasis(row, writer))
  } else if (name === "paper.get") {
    validateBasis(paperQueries["paper.get"].output.parse(result), writer)
  }
  options.signal?.throwIfAborted()
  return result
}
