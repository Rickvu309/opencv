import { randomBytes, randomUUID } from "node:crypto"

import {
  ERROR_CODES,
  PAPER_PACKAGE_LIMITS,
  PAPER_PACKAGE_PROJECTOR,
  paperPackageMetadataSchema,
  paperPackageProjectionSchema,
  paperPackageReadInputSchema,
  paperPackageStageInputSchema,
  paperPackageStageSchema,
  type PaperPackageStageInput,
} from "@workspace/domain"
import { and, asc, eq, gt, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { z } from "zod"

import { getDb, insideTransaction, transaction } from "../db/context.js"
import { files, paperPackageHeads, paperPackageVersions } from "../db/schema.js"
import { CommandError } from "../registry/errors.js"
import { PaperPackage } from "./package-engine.js"
import {
  archiveDigest,
  decodePackageCursor,
  packageDigest,
  packageFailure,
  packagePage,
} from "./package-pages.js"

export const WORD_PACKAGE_MEDIA_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
type Version = typeof paperPackageVersions.$inferSelect

function metadata(
  version: Pick<
    Version,
    "docId" | "revision" | "name" | "kind" | "packageHash" | "byteSize"
  >
) {
  return paperPackageMetadataSchema.parse({
    generation: "package",
    docId: version.docId,
    revision: version.revision,
    name: version.name,
    kind: version.kind,
    packageHash: version.packageHash,
    byteSize: version.byteSize,
  })
}

function missing(): never {
  throw new CommandError(
    ERROR_CODES.NOT_FOUND,
    "This Word document or version is not available."
  )
}

async function findStage(owner: string, requestId: string) {
  return (
    await getDb()
      .select()
      .from(paperPackageVersions)
      .where(
        and(
          eq(paperPackageVersions.userId, owner),
          eq(paperPackageVersions.requestId, requestId)
        )
      )
      .limit(1)
  )[0]
}

function sameRequest(
  version: Version,
  input: PaperPackageStageInput,
  hash: string
) {
  if (
    version.parentRevision !== null ||
    version.packageHash !== hash ||
    version.name !== input.name ||
    version.kind !== input.kind
  )
    return packageFailure(
      "This upload key was already used for another file. Use a new key."
    )
  return paperPackageStageSchema.parse({
    ...metadata(version),
    stageId: version.revision,
  })
}

async function completeVersion(version: Version) {
  const artifact = (
    await getDb()
      .select()
      .from(files)
      .where(
        and(
          eq(files.id, version.fileId),
          eq(files.userId, version.userId),
          eq(files.purpose, "package")
        )
      )
      .limit(1)
  )[0]
  if (
    !artifact ||
    artifact.mediaType !== WORD_PACKAGE_MEDIA_TYPE ||
    artifact.byteSize !== version.byteSize ||
    artifact.bytes.length !== version.byteSize ||
    archiveDigest(artifact.bytes) !== version.packageHash ||
    packageDigest(version.sidecar) !== version.sidecarHash ||
    packageDigest(version.projection) !== version.projectionHash ||
    version.projector !== PAPER_PACKAGE_PROJECTOR
  )
    return packageFailure(
      "This Word version is incomplete. No document was changed."
    )
  const projection = paperPackageProjectionSchema.parse(version.projection)
  if (
    projection.docId !== version.docId ||
    projection.incarnation !== version.incarnation ||
    projection.revision !== version.revision
  )
    return packageFailure("This Word version belongs to another document.")
  return { artifact, projection }
}

export async function stageWordPackage(
  owner: string,
  rawInput: unknown,
  rawBytes: Uint8Array
) {
  if (insideTransaction())
    return packageFailure("Prepare the Word upload before starting a save.")
  const input = paperPackageStageInputSchema.parse(rawInput)
  if (
    rawBytes.byteLength === 0 ||
    rawBytes.byteLength > PAPER_PACKAGE_LIMITS.uploadBytes
  )
    throw new CommandError(
      ERROR_CODES.VALIDATION_ERROR,
      "Choose a Word file smaller than 8 MiB."
    )
  const bytes = Buffer.from(rawBytes)
  const hash = archiveDigest(bytes)
  const previous = await findStage(owner, input.requestId)
  if (previous) {
    await completeVersion(previous)
    return sameRequest(previous, input, hash)
  }
  const context = {
    docId: randomUUID(),
    incarnation: randomUUID(),
    revision: randomUUID(),
  }
  const opened = await PaperPackage.open(bytes, context)
  const projection = paperPackageProjectionSchema.parse(opened.read())
  if (
    Buffer.byteLength(JSON.stringify(projection)) >
    PAPER_PACKAGE_LIMITS.projectionBytes
  )
    throw new CommandError(
      ERROR_CODES.VALIDATION_ERROR,
      "This Word file has too much text to read safely."
    )
  const sidecar = opened.sidecar()
  return transaction(async () => {
    const fileId = randomUUID()
    await getDb().insert(files).values({
      id: fileId,
      userId: owner,
      name: input.name,
      mediaType: WORD_PACKAGE_MEDIA_TYPE,
      byteSize: bytes.length,
      purpose: "package",
      bytes,
    })
    const inserted = await getDb()
      .insert(paperPackageVersions)
      .values({
        ...context,
        userId: owner,
        requestId: input.requestId,
        name: input.name,
        kind: input.kind,
        fileId,
        packageHash: hash,
        byteSize: bytes.length,
        sidecar,
        sidecarHash: packageDigest(sidecar),
        projection,
        projectionHash: packageDigest(projection),
        projector: PAPER_PACKAGE_PROJECTOR,
        cursorKey: randomBytes(32).toString("hex"),
      })
      .onConflictDoNothing({
        target: [paperPackageVersions.userId, paperPackageVersions.requestId],
      })
      .returning()
    const version = inserted[0]
    if (version) return sameRequest(version, input, hash)
    await getDb()
      .delete(files)
      .where(and(eq(files.id, fileId), eq(files.userId, owner)))
    const winner = await findStage(owner, input.requestId)
    if (!winner)
      return packageFailure(
        "This upload could not be saved. Try again with the same key."
      )
    await completeVersion(winner)
    return sameRequest(winner, input, hash)
  })
}

export async function publishWordPackage(
  owner: string,
  stageId: string,
  canvasProfile: string | null = null
) {
  const revision = z.string().uuid().parse(stageId)
  return transaction(async () => {
    const version = (
      await getDb()
        .select()
        .from(paperPackageVersions)
        .where(
          and(
            eq(paperPackageVersions.userId, owner),
            eq(paperPackageVersions.revision, revision)
          )
        )
        .limit(1)
    )[0]
    if (!version || version.parentRevision !== null) return missing()
    await completeVersion(version)
    await getDb()
      .insert(paperPackageHeads)
      .values({
        docId: version.docId,
        userId: owner,
        incarnation: version.incarnation,
        revision: version.revision,
        canvasProfile,
      })
      .onConflictDoNothing({ target: paperPackageHeads.docId })
    const head = await ownedHead(owner, version.docId)
    if (
      head.revision !== version.revision ||
      head.incarnation !== version.incarnation
    )
      return packageFailure(
        "This Word document has changed. Read it again before saving."
      )
    return metadata(version)
  })
}

async function ownedHead(owner: string, docId: string) {
  const head = (
    await getDb()
      .select()
      .from(paperPackageHeads)
      .where(
        and(
          eq(paperPackageHeads.userId, owner),
          eq(paperPackageHeads.docId, docId)
        )
      )
      .limit(1)
  )[0]
  return head ?? missing()
}

async function ownedVersion(owner: string, docId: string, at?: string) {
  const head = await ownedHead(owner, docId)
  const parent = alias(paperPackageVersions, "published_parent")
  const published = sql`WITH RECURSIVE published(revision, parent_revision) AS (
    SELECT ${paperPackageVersions.revision}, ${paperPackageVersions.parentRevision}
    FROM ${paperPackageVersions}
    WHERE ${paperPackageVersions.revision} = ${head.revision}
      AND ${paperPackageVersions.docId} = ${docId}
      AND ${paperPackageVersions.userId} = ${owner}
      AND ${paperPackageVersions.incarnation} = ${head.incarnation}
    UNION
    SELECT ${parent.revision}, ${parent.parentRevision}
    FROM ${paperPackageVersions} AS ${sql.identifier("published_parent")}
    JOIN published ON ${parent.revision} = published.parent_revision
    WHERE ${parent.docId} = ${docId} AND ${parent.userId} = ${owner}
      AND ${parent.incarnation} = ${head.incarnation}
  ) SELECT revision FROM published`
  const version = (
    await getDb()
      .select()
      .from(paperPackageVersions)
      .where(
        and(
          eq(paperPackageVersions.userId, owner),
          eq(paperPackageVersions.docId, docId),
          eq(paperPackageVersions.incarnation, head.incarnation),
          eq(paperPackageVersions.revision, at ?? head.revision),
          sql`${paperPackageVersions.revision} IN (${published})`
        )
      )
      .limit(1)
  )[0]
  return version ?? missing()
}

export async function wordPackageBasis(
  owner: string,
  docId: string,
  basedOn: string
) {
  const version = await ownedVersion(owner, docId, basedOn)
  const head = await ownedHead(owner, docId)
  if (head.revision !== basedOn || head.incarnation !== version.incarnation)
    return packageFailure(
      "This Word document has changed. Read it again before editing."
    )
  return { version, ...(await completeVersion(version)) }
}

export async function readWordPackage(owner: string, rawInput: unknown) {
  const input = paperPackageReadInputSchema.parse(rawInput)
  const cursor = input.cursor ? decodePackageCursor(input.cursor) : undefined
  if (
    cursor &&
    (cursor.position.docId !== input.docId ||
      (input.at !== undefined && cursor.position.revision !== input.at))
  )
    return packageFailure("This page belongs to another document or version.")
  const version = await ownedVersion(
    owner,
    input.docId,
    input.at ?? cursor?.position.revision
  )
  const { projection } = await completeVersion(version)
  return packagePage({
    metadata: metadata(version),
    projection,
    owner,
    key: version.cursorKey,
    cursor: input.cursor,
  })
}

export async function exportWordPackage(
  owner: string,
  docId: string,
  at: string
) {
  z.string().uuid().parse(docId)
  z.string().uuid().parse(at)
  const version = await ownedVersion(owner, docId, at)
  const { artifact } = await completeVersion(version)
  return { metadata: metadata(version), bytes: Buffer.from(artifact.bytes) }
}

export async function listWordPackages(owner: string, after?: string) {
  if (after) z.string().uuid().parse(after)
  const rows = await getDb()
    .select({
      docId: paperPackageVersions.docId,
      revision: paperPackageVersions.revision,
      name: paperPackageVersions.name,
      kind: paperPackageVersions.kind,
      packageHash: paperPackageVersions.packageHash,
      byteSize: paperPackageVersions.byteSize,
    })
    .from(paperPackageHeads)
    .innerJoin(
      paperPackageVersions,
      and(
        eq(paperPackageHeads.revision, paperPackageVersions.revision),
        eq(paperPackageHeads.docId, paperPackageVersions.docId),
        eq(paperPackageHeads.incarnation, paperPackageVersions.incarnation),
        eq(paperPackageHeads.userId, paperPackageVersions.userId)
      )
    )
    .where(
      and(
        eq(paperPackageHeads.userId, owner),
        after ? gt(paperPackageHeads.docId, after) : undefined
      )
    )
    .orderBy(asc(paperPackageHeads.docId))
    .limit(51)
  const items = rows.slice(0, 50).map(metadata)
  return {
    items,
    next: rows.length > 50 ? (items.at(-1)?.docId ?? null) : null,
  }
}
