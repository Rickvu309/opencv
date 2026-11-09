import { randomUUID } from "node:crypto"

import {
  PAPER_PACKAGE_LIMITS,
  PAPER_PACKAGE_PROJECTOR,
  paperPackageProjectionSchema,
} from "@workspace/domain"
import { z } from "zod"

import { insideTransaction } from "../db/context.js"
import { PaperPackage } from "./package-engine.js"
import { PACKAGE_LIMITS } from "./package-limits.js"
import {
  archiveDigest,
  packageDigest,
  packageFailure,
} from "./package-pages.js"
import { wordPackageBasis } from "./package-store.js"

const text = z
  .string()
  .refine(
    (value) => Buffer.byteLength(value) <= PACKAGE_LIMITS.targetBytes,
    "This text is larger than the supported Word region."
  )
const replacement = z
  .object({
    op: z.literal("replaceText"),
    targetId: z.string().regex(/^t_[a-f0-9]{64}$/),
    before: text.refine((value) => value.length > 0),
    after: text,
  })
  .strict()
export const wordPackageEditSchema = z
  .object({
    docId: z.string().uuid(),
    basedOn: z.string().uuid(),
    edits: z.array(replacement).min(1).max(PACKAGE_LIMITS.replacements),
  })
  .strict()

export async function prepareWordPackage(owner: string, rawInput: unknown) {
  if (insideTransaction())
    return packageFailure("Prepare the Word edit before starting a save.")
  const input = wordPackageEditSchema.parse(rawInput)
  if (Buffer.byteLength(JSON.stringify(input)) > PACKAGE_LIMITS.requestBytes)
    return packageFailure("This Word edit is too large. Send fewer changes.")
  const { version, artifact, projection } = await wordPackageBasis(
    owner,
    input.docId,
    input.basedOn
  )
  const basis = {
    docId: version.docId,
    incarnation: version.incarnation,
    revision: version.revision,
    packageHash: version.packageHash,
    sidecarHash: version.sidecarHash,
    projectionHash: version.projectionHash,
    projector: version.projector,
  }
  const opened = await PaperPackage.open(
    artifact.bytes,
    {
      docId: basis.docId,
      incarnation: basis.incarnation,
      revision: basis.revision,
    },
    version.sidecar
  )
  if (packageDigest(opened.read()) !== version.projectionHash)
    return packageFailure(
      "This Word projection is no longer available. No document was changed."
    )
  const prepared = await opened.prepare(input)
  if (prepared.changes.length === 0)
    return { kind: "unchanged" as const, basis }
  const regions = new Map(
    projection.regions.flatMap((region) =>
      region.kind === "editable" ? [[region.targetId, region] as const] : []
    )
  )
  const review = {
    docId: input.docId,
    basedOn: input.basedOn,
    changes: prepared.changes.map((change) => {
      const region = regions.get(change.targetId)
      if (!region)
        return packageFailure(
          "This Word region is no longer available. Read it again."
        )
      return {
        ...change,
        location: region.location,
        formatting: region.formatting,
        context: region.context,
      }
    }),
  }
  if (Buffer.byteLength(JSON.stringify(review)) > 128 * 1024)
    return packageFailure("This Word review is too large. Send fewer changes.")
  const revision = randomUUID()
  const bytes = prepared.package.export()
  const context = {
    docId: basis.docId,
    incarnation: basis.incarnation,
    revision,
  }
  const rebound = await PaperPackage.open(bytes, context, {
    ...prepared.package.sidecar(),
    revision,
  })
  const candidateProjection = paperPackageProjectionSchema.parse(rebound.read())
  if (
    Buffer.byteLength(JSON.stringify(candidateProjection)) >
    PAPER_PACKAGE_LIMITS.projectionBytes
  )
    return packageFailure("This Word edit has too much text to read safely.")
  const sidecar = rebound.sidecar()
  return {
    kind: "prepared" as const,
    basis,
    inputHash: packageDigest(input),
    review,
    reviewHash: packageDigest(review),
    candidate: {
      ...context,
      bytes,
      byteSize: bytes.length,
      packageHash: archiveDigest(bytes),
      sidecar,
      sidecarHash: packageDigest(sidecar),
      projection: candidateProjection,
      projectionHash: packageDigest(candidateProjection),
      projector: PAPER_PACKAGE_PROJECTOR,
    },
  }
}
