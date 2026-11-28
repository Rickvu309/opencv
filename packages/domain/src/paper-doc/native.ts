import { z } from "zod"
import type { NativePaperDocument } from "./document.js"
import type { RichPaperDocument } from "./stored-document.js"

const proseProvenanceSchema = z
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

const richCapabilities = [
  "rich-text-1",
  "semantic-cv-fields-1",
  "document-presentation-1",
  "tables-1",
  "photos-1",
  "flow-sections-1",
] as const

const richProvenanceSchema = z
  .object({
    documentVersion: z.literal(4),
    schemaRevision: z.literal(2),
    writerProtocol: z.literal(1),
    profile: z.literal("private-layout-3"),
    requiredCapabilities: z
      .array(z.enum(richCapabilities))
      .length(richCapabilities.length)
      .refine(
        (capabilities) => new Set(capabilities).size === capabilities.length
      ),
  })
  .strict()

export const nativeProvenanceSchema = z.union([
  proseProvenanceSchema,
  richProvenanceSchema,
])

export type NativeProvenance = z.infer<typeof nativeProvenanceSchema>

export function nativeProvenance(
  document: NativePaperDocument
): z.infer<typeof proseProvenanceSchema>
export function nativeProvenance(
  document: RichPaperDocument
): z.infer<typeof richProvenanceSchema>
export function nativeProvenance(
  document: NativePaperDocument | RichPaperDocument
): NativeProvenance
export function nativeProvenance(
  document: NativePaperDocument | RichPaperDocument
): NativeProvenance {
  if (document.schemaRevision === 2)
    return {
      documentVersion: 4,
      schemaRevision: 2,
      writerProtocol: 1,
      profile: document.profile,
      requiredCapabilities: [...richCapabilities],
    }
  return {
    documentVersion: document.version,
    schemaRevision: document.schemaRevision,
    writerProtocol: 1,
    requiredCapabilities: ["structured-prose", "underline"],
  }
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

export function sameNativeProvenance(
  left: NativeProvenance | undefined,
  right: NativeProvenance | undefined
): boolean {
  if (!left || !right) return left === right
  return (
    left.documentVersion === right.documentVersion &&
    left.schemaRevision === right.schemaRevision &&
    left.writerProtocol === right.writerProtocol &&
    (left.schemaRevision !== 2 ||
      (right.schemaRevision === 2 && left.profile === right.profile)) &&
    left.requiredCapabilities.length === right.requiredCapabilities.length &&
    left.requiredCapabilities.every((capability) =>
      right.requiredCapabilities.some((item) => item === capability)
    ) &&
    right.requiredCapabilities.every((capability) =>
      left.requiredCapabilities.some((item) => item === capability)
    )
  )
}
