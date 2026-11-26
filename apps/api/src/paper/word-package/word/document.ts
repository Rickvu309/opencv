import { randomUUID } from "node:crypto"

import {
  PAPER_CANVAS_PROFILE,
  PAPER_PACKAGE_LIMITS,
  PAPER_PACKAGE_PROJECTOR,
  WORD_DOCUMENT_MEDIA_TYPE,
  WORD_LIMITS,
  paperPackageProjectionSchema,
  wordBatchSchema,
  wordSourceSchema,
  wordUndoSchema,
  type WordBatch,
  type WordCommit,
  type WordDoc,
  type WordFile,
  type WordHandle,
  type WordOwner,
  type WordPage,
  type WordRefusal,
  type WordRevision,
  type WordSource,
  type WordUndo,
} from "@workspace/domain/paper-doc"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

import { getDb, insideTransaction, transaction } from "../../../db/context.js"
import { paperPackageHeads, paperPackageVersions } from "../../../db/schema.js"
import { CommandError } from "../../../platform/errors.js"
import { persistWordPackage } from "../../package-candidates.js"
import { PaperPackage } from "../../package-engine.js"
import { archiveDigest, packageDigest } from "../../package-pages.js"
import { PACKAGE_PROFILE } from "../../package-profile.js"
import { compareAndRestorePackage } from "../../package-restore.js"
import {
  exportWordPackage,
  publishWordPackage,
  stageWordPackage,
  wordPackageBasis,
} from "../../package-store.js"
import { projectParagraphs } from "./classify.js"
import { blankPageBytes, mutateWord, refuse, type WordSpans } from "./mutate.js"
import { templatePageBytes } from "./template.js"

const storedKeys = z
  .object({
    paragraphs: z.array(z.object({ key: z.string().uuid() }).passthrough()),
  })
  .passthrough()

const labelOf = z.enum(["cv", "letter"])

const notAvailable = () =>
  refuse("missing", "This Word document is not available.")

const changed = (batch: WordBatch) =>
  refuse(
    "stale",
    "This page changed. Read it again before saving. No document was changed.",
    firstHandle(batch)
  )

function firstHandle(batch: WordBatch): WordHandle | null {
  const [op] = batch.ops
  if (!op) return null
  return op.op === "insert" ? op.after : op.handle
}

function handleAt(raw: unknown, index: unknown): WordHandle | null {
  if (typeof index !== "number" || !raw || typeof raw !== "object") return null
  const ops = (raw as { ops?: unknown }).ops
  const op: unknown = Array.isArray(ops) ? ops[index] : null
  if (!op || typeof op !== "object") return null
  const named = (op as { handle?: unknown; after?: unknown }).handle
  const after = (op as { after?: unknown }).after
  const handle = named ?? after
  return typeof handle === "string" &&
    z.string().uuid().safeParse(handle).success
    ? handle
    : null
}

function checkBatch(raw: WordBatch): WordBatch | WordRefusal {
  const parsed = wordBatchSchema.safeParse(raw)
  if (parsed.success) {
    if (
      Buffer.byteLength(JSON.stringify(parsed.data)) >
      WORD_LIMITS.maxEncodedBatchBytes
    )
      return refuse(
        "limit",
        "This edit is too large to save. No document was changed.",
        null,
        "BATCH_BYTES"
      )
    return parsed.data
  }
  const issue = parsed.error.issues[0]
  const path = issue?.path ?? []
  if (path[0] === "basedOn")
    return refuse(
      "stale",
      "Read the page again before saving. No document was changed.",
      null,
      "BASED_ON"
    )
  if (path[0] === "doc") return notAvailable()
  if (path[0] === "ops" && path.at(-1) === "text")
    return refuse(
      "plain",
      "Use plain words on one line, up to 8 KiB. No document was changed.",
      handleAt(raw, path[1]),
      "PLAIN_TEXT"
    )
  if (path.length === 0 || (path[0] === "ops" && issue?.code === "too_big"))
    return refuse(
      "limit",
      "This edit is too large to save. No document was changed.",
      null,
      "BATCH_SIZE"
    )
  return refuse(
    "order",
    "This edit is not a Word batch. No document was changed.",
    handleAt(raw, path[1]),
    "BATCH"
  )
}

async function headOf(owner: WordOwner, doc: WordDoc) {
  const [head] = await getDb()
    .select({
      incarnation: paperPackageHeads.incarnation,
      revision: paperPackageHeads.revision,
    })
    .from(paperPackageHeads)
    .where(
      and(eq(paperPackageHeads.userId, owner), eq(paperPackageHeads.docId, doc))
    )
    .limit(1)
  return head ?? null
}

async function readPage(
  owner: WordOwner,
  doc: WordDoc,
  at?: WordRevision
): Promise<WordPage | WordRefusal> {
  const head = await headOf(owner, doc)
  if (!head) return notAvailable()
  const revision = at ?? head.revision
  let exported: Awaited<ReturnType<typeof exportWordPackage>>
  try {
    exported = await exportWordPackage(owner, doc, revision)
  } catch (error) {
    if (error instanceof CommandError || error instanceof z.ZodError)
      return refuse("missing", "This Word revision is not available.")
    throw error
  }
  const [row] = await getDb()
    .select({ sidecar: paperPackageVersions.sidecar })
    .from(paperPackageVersions)
    .where(
      and(
        eq(paperPackageVersions.userId, owner),
        eq(paperPackageVersions.docId, doc),
        eq(paperPackageVersions.revision, revision)
      )
    )
    .limit(1)
  const keys = storedKeys.safeParse(row?.sidecar)
  const label = labelOf.safeParse(exported.metadata.kind)
  const paragraphs = keys.success
    ? projectParagraphs(
        exported.bytes,
        keys.data.paragraphs.map((paragraph) => paragraph.key)
      )
    : null
  if (!paragraphs || !label.success)
    return refuse("closed", "This page cannot be read safely.", null, "SIDECAR")
  return {
    doc,
    revision,
    name: exported.metadata.name,
    label: label.data,
    paragraphs,
  }
}

async function draftCandidate(
  owner: WordOwner,
  batch: WordBatch,
  spans: WordSpans = new Map()
) {
  const { version, artifact } = await wordPackageBasis(
    owner,
    batch.doc,
    batch.basedOn
  )
  const opened = await PaperPackage.open(
    artifact.bytes,
    {
      docId: version.docId,
      incarnation: version.incarnation,
      revision: version.revision,
    },
    version.sidecar
  )
  if (packageDigest(opened.read()) !== version.projectionHash)
    return refuse(
      "closed",
      "This Word projection is no longer available. No document was changed.",
      null,
      "PROJECTION"
    )
  if (opened.readOnly())
    return refuse(
      "closed",
      "Paper can read this Word file but cannot safely change it, because it uses Word features Paper cannot check yet. No document was changed.",
      null,
      "READ_ONLY_PACKAGE"
    )
  const drafted = mutateWord(
    artifact.bytes,
    {
      version: 2,
      paragraphs: opened.sidecar().paragraphs.map((row) => ({
        key: row.key,
        ordinal: row.ordinal,
        textIds: [...row.textIds],
      })),
    },
    batch.ops,
    spans
  )
  if (drafted.refused) return drafted
  const revision = randomUUID()
  const bytes = Buffer.from(drafted.bytes)
  const context = {
    docId: version.docId,
    incarnation: version.incarnation,
    revision,
  }
  const rebound = await PaperPackage.open(bytes, context, {
    version: 2,
    profile: PACKAGE_PROFILE.version,
    revision,
    docId: context.docId,
    incarnation: context.incarnation,
    packageHash: archiveDigest(bytes),
    paragraphs: drafted.sidecar.paragraphs,
  })
  const projection = paperPackageProjectionSchema.parse(rebound.read())
  if (
    Buffer.byteLength(JSON.stringify(projection)) >
    PAPER_PACKAGE_LIMITS.projectionBytes
  )
    return refuse(
      "closed",
      "This Word edit has too much text to read safely.",
      null,
      "PROJECTION_BYTES"
    )
  const sidecar = rebound.sidecar()
  const paragraphs = projectParagraphs(
    bytes,
    sidecar.paragraphs.map((row) => row.key)
  )
  const label = labelOf.safeParse(version.kind)
  if (!paragraphs || !label.success)
    return refuse("closed", "This page cannot be read safely.", null, "SIDECAR")
  const page: WordPage = {
    doc: batch.doc,
    revision,
    name: version.name,
    label: label.data,
    paragraphs,
  }
  return {
    refused: false as const,
    basis: {
      docId: version.docId,
      incarnation: version.incarnation,
      revision: version.revision,
      packageHash: version.packageHash,
      sidecarHash: version.sidecarHash,
      projectionHash: version.projectionHash,
      projector: version.projector,
    },
    candidate: {
      ...context,
      bytes,
      byteSize: bytes.length,
      packageHash: archiveDigest(bytes),
      sidecar,
      sidecarHash: packageDigest(sidecar),
      projection,
      projectionHash: packageDigest(projection),
      projector: PAPER_PACKAGE_PROJECTOR,
    },
    page,
  }
}

async function guarded<Result>(
  owner: WordOwner,
  raw: WordBatch,
  step: (batch: WordBatch) => Promise<Result | WordRefusal>
): Promise<Result | WordRefusal> {
  if (insideTransaction())
    return refuse(
      "closed",
      "Prepare the Word edit before starting a save.",
      null,
      "IN_TRANSACTION"
    )
  const batch = checkBatch(raw)
  if ("refused" in batch) return batch
  const head = await headOf(owner, batch.doc)
  if (!head) return notAvailable()
  if (head.revision !== batch.basedOn) return changed(batch)
  try {
    return await step(batch)
  } catch (error) {
    if (!(error instanceof CommandError)) throw error
    const now = await headOf(owner, batch.doc)
    if (now?.revision !== batch.basedOn) return changed(batch)
    return refuse("closed", error.message, firstHandle(batch), "STORE")
  }
}

export function draftBatch(
  owner: WordOwner,
  raw: WordBatch,
  spans: WordSpans = new Map()
) {
  return guarded(owner, raw, (batch) => draftCandidate(owner, batch, spans))
}

export function prepareBatch<Review>(
  owner: WordOwner,
  raw: WordBatch,
  review: Review
) {
  return guarded(owner, raw, async (batch) => {
    const drafted = await draftCandidate(owner, batch)
    if (drafted.refused) return drafted
    const prepared = await persistWordPackage(
      owner,
      {
        basis: drafted.basis,
        inputHash: packageDigest(review),
        review,
        reviewHash: packageDigest(review),
        candidate: drafted.candidate,
      },
      PAPER_CANVAS_PROFILE,
      true
    )
    return {
      refused: false as const,
      prepared,
      page: drafted.page,
      incarnation: drafted.basis.incarnation,
    }
  })
}

export async function open(
  owner: WordOwner,
  source: WordSource
): Promise<WordPage | WordRefusal> {
  const parsed = wordSourceSchema.safeParse(source)
  if (!parsed.success)
    return refuse("closed", "This Word document cannot be opened.")
  if (parsed.data.kind === "read")
    return readPage(owner, parsed.data.doc, parsed.data.at)
  const stage = await stageWordPackage(
    owner,
    {
      requestId: randomUUID(),
      name: parsed.data.name,
      kind: parsed.data.label,
    },
    parsed.data.templateId
      ? templatePageBytes(parsed.data.templateId)
      : blankPageBytes()
  )
  const published = await publishWordPackage(
    owner,
    stage.stageId,
    PAPER_CANVAS_PROFILE
  )
  return readPage(owner, published.docId, published.revision)
}

export async function apply(
  owner: WordOwner,
  batch: WordBatch
): Promise<WordCommit | WordRefusal> {
  const drafted = await prepareBatch(owner, batch, batch)
  if (drafted.refused) return drafted
  try {
    await transaction(() =>
      compareAndRestorePackage(
        owner,
        batch.doc,
        drafted.incarnation,
        batch.basedOn,
        drafted.page.revision
      )
    )
  } catch (error) {
    if (error instanceof CommandError) return changed(batch)
    throw error
  }
  return {
    refused: false,
    page: drafted.page,
    undo: {
      doc: batch.doc,
      revision: drafted.page.revision,
      restore: batch.basedOn,
    },
  }
}

export const WORD_UNDO_MOVED =
  "This page changed after that save, so Undo was skipped."

export async function undo(
  owner: WordOwner,
  handle: WordUndo
): Promise<WordCommit | WordRefusal> {
  const parsed = wordUndoSchema.safeParse(handle)
  if (!parsed.success)
    return refuse("stale", "This Undo is no longer available.")
  const { doc, revision, restore } = parsed.data
  const head = await headOf(owner, doc)
  if (!head) return notAvailable()
  const skipped = () => refuse("stale", WORD_UNDO_MOVED)
  if (head.revision !== revision) return skipped()
  try {
    await transaction(() =>
      compareAndRestorePackage(owner, doc, head.incarnation, revision, restore)
    )
  } catch (error) {
    if (error instanceof CommandError) return skipped()
    throw error
  }
  const page = await readPage(owner, doc, restore)
  if ("refused" in page) return page
  return { refused: false, page, undo: null }
}

export async function exportWord(
  owner: WordOwner,
  doc: WordDoc,
  at: WordRevision
): Promise<WordFile | WordRefusal> {
  try {
    const exported = await exportWordPackage(owner, doc, at)
    return {
      bytes: new Uint8Array(exported.bytes),
      mediaType: WORD_DOCUMENT_MEDIA_TYPE,
      revision: at,
    }
  } catch (error) {
    if (error instanceof CommandError || error instanceof z.ZodError)
      return refuse("missing", "This Word revision is not available.")
    throw error
  }
}
