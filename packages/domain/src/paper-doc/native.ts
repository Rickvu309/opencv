import { z } from "zod"

import { paperIdSchema } from "../ids.js"
import type { NativePaperDocument } from "./document.js"
import { paperSyncInputSchema, paperSyncOutputSchema } from "./sync.js"

export const nativeWriterSchema = z
  .object({
    documentVersion: z.literal(4),
    writerProtocol: z.literal(1),
    supportedSchemaRevisions: z
      .array(z.number().int().positive())
      .min(1)
      .max(16),
    capabilities: z.array(z.string().min(1).max(64)).max(32),
  })
  .strict()

export type NativeWriter = z.infer<typeof nativeWriterSchema>

export const NATIVE_WRITER: NativeWriter = {
  documentVersion: 4,
  writerProtocol: 1,
  supportedSchemaRevisions: [1],
  capabilities: ["structured-prose", "underline"],
}

export const nativeProvenanceSchema = z
  .object({
    documentVersion: z.literal(4),
    schemaRevision: z.literal(1),
    writerProtocol: z.literal(1),
    requiredCapabilities: z
      .array(z.enum(["structured-prose", "underline"]))
      .length(2)
      .refine(
        (capabilities) => new Set(capabilities).size === capabilities.length
      ),
  })
  .strict()

export type NativeProvenance = z.infer<typeof nativeProvenanceSchema>

export function nativeProvenance(
  document: NativePaperDocument
): NativeProvenance {
  return {
    documentVersion: document.version,
    schemaRevision: document.schemaRevision,
    writerProtocol: 1,
    requiredCapabilities: ["structured-prose", "underline"],
  }
}

export function nativeAdmission(
  document: NativePaperDocument,
  writer: NativeWriter | undefined
): string | null {
  if (
    !writer ||
    writer.documentVersion !== document.version ||
    writer.writerProtocol !== 1
  )
    return "This document needs a newer Paper editor. Nothing was acknowledged or changed."
  if (!writer.supportedSchemaRevisions.includes(document.schemaRevision))
    return "This editor cannot read this document schema. Nothing was acknowledged or changed."
  if (
    nativeProvenance(document).requiredCapabilities.some(
      (capability) => !writer.capabilities.includes(capability)
    )
  )
    return "This editor is missing a document capability. Nothing was acknowledged or changed."
  return null
}

export const nativeBasisSchema = z
  .object({
    provenance: nativeProvenanceSchema,
    epoch: z.number().int().positive(),
    revision: z.number().int().nonnegative(),
    digest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()

export type NativeBasis = z.infer<typeof nativeBasisSchema>

export const nativeSyncInputSchema = paperSyncInputSchema
  .extend({ writer: nativeWriterSchema, provenance: nativeProvenanceSchema })
  .strict()
export const nativeSyncOutputSchema = paperSyncOutputSchema
  .extend({ provenance: nativeProvenanceSchema })
  .strict()
export const nativeMigrateInputSchema = z
  .object({
    docId: paperIdSchema,
    epoch: z.number().int().positive(),
    basedOn: z.number().int().nonnegative(),
    writer: nativeWriterSchema,
  })
  .strict()
export function sameNativeProvenance(
  left: NativeProvenance | undefined,
  right: NativeProvenance | undefined
): boolean {
  if (!left || !right) return left === right
  return (
    left.documentVersion === right.documentVersion &&
    left.schemaRevision === right.schemaRevision &&
    left.writerProtocol === right.writerProtocol &&
    left.requiredCapabilities.length === right.requiredCapabilities.length &&
    left.requiredCapabilities.every((capability) =>
      right.requiredCapabilities.includes(capability)
    ) &&
    right.requiredCapabilities.every((capability) =>
      left.requiredCapabilities.includes(capability)
    )
  )
}
