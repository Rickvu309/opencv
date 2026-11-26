import { z } from "zod"
import { paperIdSchema } from "@workspace/domain/kernel"
import {
  nativeProvenanceSchema,
  nativeWriterSchema,
  sameNativeProvenance,
} from "@workspace/domain/paper-doc"

const nativeIdentitySchema = z
  .object({
    kind: z.literal("native"),
    ownerId: z.string().min(1),
    docId: paperIdSchema,
    sessionId: z.string().min(1),
    provenance: nativeProvenanceSchema,
    writer: nativeWriterSchema,
  })
  .strict()
  .superRefine((identity, ctx) => {
    if (
      !identity.writer.supportedSchemaRevisions.includes(
        identity.provenance.schemaRevision
      ) ||
      identity.provenance.requiredCapabilities.some(
        (value) => !identity.writer.capabilities.includes(value)
      )
    )
      ctx.addIssue({ code: "custom", message: "Unsupported native writer" })
  })

export type NativeSyncIdentity = z.infer<typeof nativeIdentitySchema>

export function requireNativeIdentity(value: unknown): NativeSyncIdentity {
  return nativeIdentitySchema.parse(value)
}

export function nativeRecoveryScope(value: NativeSyncIdentity): string {
  const identity = requireNativeIdentity(value)
  return `native-r1:${encodeURIComponent(identity.ownerId)}:${encodeURIComponent(identity.docId)}`
}

export function nativeRuntimeScope(identity: NativeSyncIdentity): string {
  return `${nativeRecoveryScope(identity)}:${encodeURIComponent(identity.sessionId)}`
}

export function sameNativeSession(
  left: NativeSyncIdentity,
  right: unknown
): boolean {
  const parsed = nativeIdentitySchema.safeParse(right)
  return (
    parsed.success &&
    nativeRuntimeScope(left) === nativeRuntimeScope(parsed.data) &&
    sameNativeProvenance(left.provenance, parsed.data.provenance) &&
    JSON.stringify(left.writer) === JSON.stringify(parsed.data.writer)
  )
}
