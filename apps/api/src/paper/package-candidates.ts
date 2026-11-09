import { randomBytes, randomUUID } from "node:crypto"

import {
  PAPER_PACKAGE_LIMITS,
  PAPER_PACKAGE_PROJECTOR,
  paperPackageProjectionSchema,
} from "@workspace/domain"
import { and, count, eq, inArray, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { z } from "zod"

import { getDb, insideTransaction, transaction } from "../db/context.js"
import {
  files,
  paperPackageCandidates,
  paperPackageHeads,
  paperPackageVersions,
  user,
} from "../db/schema.js"
import { PaperPackage } from "./package-engine.js"
import { PACKAGE_PROFILE } from "./package-profile.js"
import {
  archiveDigest,
  packageDigest,
  packageFailure,
} from "./package-pages.js"
import { prepareWordPackage, wordPackageEditSchema } from "./package-planner.js"
import { compareAndRestorePackage, readPackageHead } from "./package-restore.js"
import { wordPackageBasis } from "./package-store.js"

const hash = z.string().regex(/^[a-f0-9]{64}$/)
export const wordCandidateSchema = z
  .object({ id: z.string().uuid(), digest: hash })
  .strict()
type Candidate = z.infer<typeof wordCandidateSchema>
const identitySchema = z
  .object({
    revision: z.string().uuid(),
    parentRevision: z.string().uuid().nullable(),
    fileId: z.string().uuid(),
    packageHash: hash,
    byteSize: z.number().int().positive(),
    sidecarHash: hash,
    projectionHash: hash,
    projector: z.literal(PAPER_PACKAGE_PROJECTOR),
  })
  .strict()
const sealSchema = z
  .object({
    version: z.literal(1),
    id: z.string().uuid(),
    owner: z.string(),
    docId: z.string().uuid(),
    incarnation: z.string().uuid(),
    profile: z.literal(PACKAGE_PROFILE.version),
    inputHash: hash,
    reviewHash: hash,
    basis: identitySchema,
    forward: identitySchema,
    restore: identitySchema,
  })
  .strict()
type Seal = z.infer<typeof sealSchema>
type Prepared = { candidate: Candidate; review: unknown }

const versionIdentity = {
  revision: paperPackageVersions.revision,
  parentRevision: paperPackageVersions.parentRevision,
  fileId: paperPackageVersions.fileId,
  packageHash: paperPackageVersions.packageHash,
  byteSize: paperPackageVersions.byteSize,
  sidecarHash: paperPackageVersions.sidecarHash,
  projectionHash: paperPackageVersions.projectionHash,
  projector: paperPackageVersions.projector,
}

function unavailable(): never {
  return packageFailure(
    "This saved Word edit is no longer available. No document was changed."
  )
}

const retentionLimits = { count: 64, bytes: 64 * 1024 * 1024 }

async function requireCandidateCapacity(
  owner: string,
  packageBytes: number,
  material: unknown[]
) {
  const [account] = await getDb()
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, owner))
    .for("no key update")
  if (!account) return unavailable()
  const forward = alias(paperPackageVersions, "retained_forward")
  const restore = alias(paperPackageVersions, "retained_restore")
  const [usage] = await getDb()
    .select({
      count: count(),
      bytes: sql<number>`coalesce(sum(
        ${forward.byteSize}::bigint + ${restore.byteSize}::bigint
        + octet_length(${paperPackageCandidates.seal}::text)
        + octet_length(${forward.sidecar}::text)
        + octet_length(${forward.projection}::text)
        + octet_length(${restore.sidecar}::text)
        + octet_length(${restore.projection}::text)
      ), 0) + ${packageBytes}::bigint
        + octet_length(${JSON.stringify(material)}::jsonb::text)`.mapWith(
        Number
      ),
    })
    .from(paperPackageCandidates)
    .innerJoin(
      forward,
      eq(forward.revision, paperPackageCandidates.forwardRevision)
    )
    .innerJoin(
      restore,
      eq(restore.revision, paperPackageCandidates.restoreRevision)
    )
    .where(eq(paperPackageCandidates.userId, owner))
  if (
    !usage ||
    usage.count >= retentionLimits.count ||
    usage.bytes > retentionLimits.bytes
  )
    return packageFailure(
      "Word edit storage is full. Your document, saved reviews, and Undo are unchanged."
    )
}

export async function prepareStoredWordPackage(
  owner: string,
  rawInput: unknown
) {
  if (insideTransaction())
    return packageFailure("Prepare the Word edit before starting a save.")
  const plan = await prepareWordPackage(owner, rawInput)
  if (plan.kind === "unchanged") return plan
  const basis = await wordPackageBasis(
    owner,
    plan.basis.docId,
    plan.basis.revision
  )
  if (
    basis.version.incarnation !== plan.basis.incarnation ||
    basis.version.packageHash !== plan.basis.packageHash ||
    basis.version.sidecarHash !== plan.basis.sidecarHash ||
    basis.version.projectionHash !== plan.basis.projectionHash
  )
    return unavailable()
  const restoreRevision = randomUUID()
  const restored = await PaperPackage.open(
    basis.artifact.bytes,
    {
      docId: plan.basis.docId,
      incarnation: plan.basis.incarnation,
      revision: restoreRevision,
    },
    {
      ...plan.candidate.sidecar,
      revision: restoreRevision,
      packageHash: plan.basis.packageHash,
    }
  )
  const projection = paperPackageProjectionSchema.parse(restored.read())
  if (
    Buffer.byteLength(JSON.stringify(projection)) >
    PAPER_PACKAGE_LIMITS.projectionBytes
  )
    return packageFailure("This Word restore has too much text to read safely.")
  const sidecar = restored.sidecar()
  const id = randomUUID()
  const fileId = randomUUID()
  const seal = sealSchema.parse({
    version: 1,
    id,
    owner,
    docId: plan.basis.docId,
    incarnation: plan.basis.incarnation,
    profile: PACKAGE_PROFILE.version,
    inputHash: plan.inputHash,
    reviewHash: plan.reviewHash,
    basis: {
      revision: basis.version.revision,
      parentRevision: basis.version.parentRevision,
      fileId: basis.version.fileId,
      packageHash: basis.version.packageHash,
      byteSize: basis.version.byteSize,
      sidecarHash: basis.version.sidecarHash,
      projectionHash: basis.version.projectionHash,
      projector: basis.version.projector,
    },
    forward: {
      revision: plan.candidate.revision,
      parentRevision: plan.basis.revision,
      fileId,
      packageHash: plan.candidate.packageHash,
      byteSize: plan.candidate.byteSize,
      sidecarHash: plan.candidate.sidecarHash,
      projectionHash: plan.candidate.projectionHash,
      projector: plan.candidate.projector,
    },
    restore: {
      revision: restoreRevision,
      parentRevision: plan.candidate.revision,
      fileId: basis.version.fileId,
      packageHash: plan.basis.packageHash,
      byteSize: basis.version.byteSize,
      sidecarHash: packageDigest(sidecar),
      projectionHash: packageDigest(projection),
      projector: PAPER_PACKAGE_PROJECTOR,
    },
  })
  const digest = packageDigest(seal)
  await transaction(async () => {
    await requireCandidateCapacity(
      owner,
      seal.forward.byteSize + seal.restore.byteSize,
      [
        seal,
        plan.candidate.sidecar,
        plan.candidate.projection,
        sidecar,
        projection,
      ]
    )
    const [version] = await getDb()
      .select()
      .from(paperPackageVersions)
      .where(eq(paperPackageVersions.revision, seal.basis.revision))
      .for("update")
    const [artifact] = await getDb()
      .select()
      .from(files)
      .where(eq(files.id, seal.basis.fileId))
      .for("update")
    if (
      !version ||
      !artifact ||
      packageDigest(version) !== packageDigest(basis.version) ||
      artifact.userId !== owner ||
      artifact.purpose !== "package" ||
      artifact.mediaType !== basis.artifact.mediaType ||
      artifact.byteSize !== seal.basis.byteSize ||
      artifact.bytes.length !== seal.basis.byteSize ||
      archiveDigest(artifact.bytes) !== seal.basis.packageHash
    )
      return unavailable()
    await getDb()
      .insert(files)
      .values({
        id: fileId,
        userId: owner,
        name: basis.version.name,
        mediaType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        byteSize: plan.candidate.byteSize,
        purpose: "package",
        bytes: Buffer.from(plan.candidate.bytes),
      })
    await getDb()
      .insert(paperPackageVersions)
      .values(
        [
          {
            identity: seal.forward,
            sidecar: plan.candidate.sidecar,
            projection: plan.candidate.projection,
          },
          { identity: seal.restore, sidecar, projection },
        ].map((item) => ({
          ...item.identity,
          userId: owner,
          docId: seal.docId,
          incarnation: seal.incarnation,
          requestId: randomUUID(),
          name: basis.version.name,
          kind: basis.version.kind,
          sidecar: item.sidecar,
          projection: item.projection,
          cursorKey: randomBytes(32).toString("hex"),
        }))
      )
    await getDb().insert(paperPackageCandidates).values({
      id,
      userId: owner,
      docId: seal.docId,
      incarnation: seal.incarnation,
      basisRevision: seal.basis.revision,
      forwardRevision: seal.forward.revision,
      restoreRevision: seal.restore.revision,
      seal,
      digest,
    })
  })
  return {
    kind: "prepared" as const,
    candidate: { id, digest },
    review: plan.review,
  }
}

async function retained(owner: string, rawCandidate: unknown) {
  if (!insideTransaction())
    return packageFailure("Save this Word edit inside its command transaction.")
  const candidate = wordCandidateSchema.parse(rawCandidate)
  const [record] = await getDb()
    .select()
    .from(paperPackageCandidates)
    .where(
      and(
        eq(paperPackageCandidates.id, candidate.id),
        eq(paperPackageCandidates.userId, owner)
      )
    )
  if (
    !record ||
    record.digest !== candidate.digest ||
    packageDigest(record.seal) !== candidate.digest
  )
    return unavailable()
  const parsed = sealSchema.safeParse(record.seal)
  if (!parsed.success) return unavailable()
  const seal = parsed.data
  if (
    seal.id !== record.id ||
    seal.owner !== owner ||
    seal.docId !== record.docId ||
    seal.incarnation !== record.incarnation ||
    seal.basis.revision !== record.basisRevision ||
    seal.forward.revision !== record.forwardRevision ||
    seal.restore.revision !== record.restoreRevision ||
    seal.forward.parentRevision !== seal.basis.revision ||
    seal.restore.parentRevision !== seal.forward.revision ||
    seal.restore.revision === seal.basis.revision ||
    seal.restore.revision === seal.forward.revision ||
    seal.restore.packageHash !== seal.basis.packageHash ||
    seal.restore.fileId !== seal.basis.fileId
  )
    return unavailable()
  const identities = [seal.basis, seal.forward, seal.restore]
  const versions = await getDb()
    .select(versionIdentity)
    .from(paperPackageVersions)
    .where(
      and(
        eq(paperPackageVersions.userId, owner),
        eq(paperPackageVersions.docId, seal.docId),
        eq(paperPackageVersions.incarnation, seal.incarnation),
        inArray(
          paperPackageVersions.revision,
          identities.map((item) => item.revision)
        )
      )
    )
  if (
    identities.some(
      (identity) =>
        !versions.some(
          (version) => packageDigest(version) === packageDigest(identity)
        )
    )
  )
    return unavailable()
  const artifacts = await getDb()
    .select({ id: files.id, byteSize: files.byteSize })
    .from(files)
    .where(
      and(
        eq(files.userId, owner),
        eq(files.purpose, "package"),
        eq(
          files.mediaType,
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ),
        inArray(
          files.id,
          identities.map((item) => item.fileId)
        )
      )
    )
  if (
    identities.some(
      (identity) =>
        !artifacts.some(
          (file) =>
            file.id === identity.fileId && file.byteSize === identity.byteSize
        )
    )
  )
    return unavailable()
  return seal
}

async function requireHead(seal: Seal, revision: string) {
  const [head] = await getDb()
    .select({ revision: paperPackageHeads.revision })
    .from(paperPackageHeads)
    .where(
      and(
        eq(paperPackageHeads.userId, seal.owner),
        eq(paperPackageHeads.docId, seal.docId),
        eq(paperPackageHeads.incarnation, seal.incarnation),
        eq(paperPackageHeads.revision, revision)
      )
    )
  if (!head) return unavailable()
}

export async function revalidateWordCandidate(
  owner: string,
  rawInput: unknown,
  prepared: Prepared
) {
  const seal = await retained(owner, prepared.candidate)
  const input = wordPackageEditSchema.parse(rawInput)
  if (
    seal.inputHash !== packageDigest(input) ||
    seal.reviewHash !== packageDigest(prepared.review)
  )
    return unavailable()
  await requireHead(seal, seal.basis.revision)
  return seal
}

async function publish(seal: Seal, direction: "forward" | "restore") {
  const identity = seal[direction]
  if (identity.parentRevision === null) return unavailable()
  const changed = await getDb()
    .update(paperPackageHeads)
    .set({ revision: identity.revision })
    .where(
      and(
        eq(paperPackageHeads.userId, seal.owner),
        eq(paperPackageHeads.docId, seal.docId),
        eq(paperPackageHeads.incarnation, seal.incarnation),
        eq(paperPackageHeads.revision, identity.parentRevision)
      )
    )
    .returning({ revision: paperPackageHeads.revision })
  if (changed.length !== 1) return unavailable()
  return {
    docId: seal.docId,
    incarnation: seal.incarnation,
    revision: identity.revision,
  }
}

export async function commitWordCandidate(
  owner: string,
  rawInput: unknown,
  prepared: Prepared
) {
  const seal = await revalidateWordCandidate(owner, rawInput, prepared)
  const result = await publish(seal, "forward")
  return { ...result, restore: prepared.candidate }
}

export async function restoreWordCandidate(
  owner: string,
  rawCandidate: unknown,
  expectedRevision: string
) {
  const seal = await retained(owner, rawCandidate)
  const expected = seal.restore.parentRevision
  if (
    expected === null ||
    expectedRevision !== seal.forward.revision ||
    expected !== seal.forward.revision
  )
    return unavailable()
  await readPackageHead(
    owner,
    seal.docId,
    seal.incarnation,
    seal.forward.revision
  )
  return compareAndRestorePackage(
    owner,
    seal.docId,
    seal.incarnation,
    expected,
    seal.restore.revision
  )
}
