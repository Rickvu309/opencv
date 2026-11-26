import { catalog, z } from "@workspace/domain/kernel"
import {
  NATIVE_WRITER,
  nativeWriterSchema,
  nativeBasisSchema,
  nativeProvenance,
  nativeAdmission,
  sameNativeProvenance,
  paperDocumentInfoSchema,
  paperViewSchema,
  type NativeWriter,
  type PaperView,
} from "@workspace/domain/paper-doc"

import { catalogClient } from "./contract-client.ts"
import { readPaperList } from "./paper-list.ts"

export type PaperQualification = {
  ownerId: string
  sessionId: string
  writer?: NativeWriter
  signal?: AbortSignal
}

type QualifiedRead = "paper.list" | "paper.read"

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
): Promise<PaperView[]>
export async function qualifiedPaperRead(
  name: "paper.read",
  docId: string,
  options: PaperQualification
): Promise<ReturnType<typeof paperDocumentInfoSchema.parse>>
export async function qualifiedPaperRead(
  name: QualifiedRead,
  docId: string,
  options: PaperQualification
) {
  const writer = paperWriter(options)
  qualifiedPaperKey([name], options)
  options.signal?.throwIfAborted()
  if (name === "paper.read") {
    const payload = await catalogClient.read(
      catalog["paper.read"].name,
      { view: "info", docId, writer },
      options.signal ? { signal: options.signal } : {}
    )
    options.signal?.throwIfAborted()
    const info = paperDocumentInfoSchema.parse(payload)
    options.signal?.throwIfAborted()
    return info
  }
  const rows = z
    .array(paperViewSchema)
    .parse(
      await readPaperList(
        { writer },
        options.signal ? { signal: options.signal } : {}
      )
    )
  rows.forEach((row) => validateBasis(row, writer))
  options.signal?.throwIfAborted()
  return rows
}
