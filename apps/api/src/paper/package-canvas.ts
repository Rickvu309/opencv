import { randomUUID } from "node:crypto"
import { createRequire } from "node:module"

import {
  ERROR_CODES,
  PAPER_CANVAS_PROFILE,
  PAPER_PACKAGE_LIMITS,
  PAPER_PACKAGE_PROJECTOR,
  paperCanvasCommitSchema,
  paperPackageEditResultSchema,
  paperPackageProjectionSchema,
  type PaperCanvasCommit,
} from "@workspace/domain"
import { and, eq } from "drizzle-orm"

import { getDb, insideTransaction, transaction } from "../db/context.js"
import { paperPackageHeads } from "../db/schema.js"
import { CommandError } from "../registry/errors.js"
import type { Registry } from "../registry/registry.js"
import {
  commitWordCandidate,
  persistWordPackage,
} from "./package-candidates.js"
import { PaperPackage } from "./package-engine.js"
import { PACKAGE_PROFILE } from "./package-profile.js"
import {
  archiveDigest,
  packageDigest,
  packageFailure,
} from "./package-pages.js"
import {
  publishWordPackage,
  readWordPackage,
  stageWordPackage,
  wordPackageBasis,
} from "./package-store.js"

const loaded = createRequire(import.meta.url)(
  "../../../../scripts/lib/paper-canvas-bytes.mjs"
) as {
  applyCanvasBytes: (
    bytes: Uint8Array,
    edit: { op: string; paragraph: string; at?: number },
    side: {
      version: 2
      paragraphs: { key: string; ordinal: number; textIds: string[] }[]
    }
  ) => {
    status: string
    bytes: Uint8Array
    sidecar: {
      version: 2
      paragraphs: { key: string; ordinal: number; textIds: string[] }[]
    }
  }
  mintBlankBytes: () => Uint8Array
}

type CanvasResult = ReturnType<typeof paperPackageEditResultSchema.parse>

function requireEnabled() {
  if (process.env.PAPER_PACKAGE_ENABLED !== "true")
    throw new CommandError(
      ERROR_CODES.NOT_FOUND,
      "Saved Word documents are unavailable."
    )
}

async function incarnationOf(owner: string, docId: string) {
  const [head] = await getDb()
    .select({ incarnation: paperPackageHeads.incarnation })
    .from(paperPackageHeads)
    .where(
      and(
        eq(paperPackageHeads.userId, owner),
        eq(paperPackageHeads.docId, docId)
      )
    )
    .limit(1)
  if (!head)
    return packageFailure(
      "This saved Word edit is no longer available. No document was changed."
    )
  return head.incarnation
}

async function resultOf(
  owner: string,
  docId: string,
  revision: string,
  restore: { id: string; digest: string } | null
): Promise<CanvasResult> {
  const page = await readWordPackage(owner, { docId, at: revision })
  return paperPackageEditResultSchema.parse({
    generation: "package",
    docId,
    revision,
    name: page.name,
    kind: page.kind,
    packageHash: page.packageHash,
    byteSize: page.byteSize,
    incarnation: await incarnationOf(owner, docId),
    restore,
  })
}

async function mintPage(owner: string) {
  const stage = await stageWordPackage(
    owner,
    { requestId: randomUUID(), name: "Page.docx", kind: "letter" },
    loaded.mintBlankBytes()
  )
  const published = await publishWordPackage(owner, stage.stageId)
  return resultOf(owner, published.docId, published.revision, null)
}

export async function prepareCanvas(
  owner: string,
  input: Exclude<PaperCanvasCommit, { op: "mint" }>
) {
  if (insideTransaction())
    return packageFailure("Prepare the Word edit before starting a save.")
  const { version, artifact } = await wordPackageBasis(
    owner,
    input.docId,
    input.basedOn
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
    return packageFailure(
      "This Word projection is no longer available. No document was changed."
    )
  const current = opened.sidecar()
  const applied = loaded.applyCanvasBytes(artifact.bytes, input, {
    version: 2,
    paragraphs: current.paragraphs.map((row) => ({
      key: row.key,
      ordinal: row.ordinal,
      textIds: [...row.textIds],
    })),
  })
  if (applied.status !== "APPLIED")
    return packageFailure(
      "This page change is not available. No document was changed."
    )
  const revision = randomUUID()
  const bytes = Buffer.from(applied.bytes)
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
    paragraphs: applied.sidecar.paragraphs,
  })
  const projection = paperPackageProjectionSchema.parse(rebound.read())
  if (
    Buffer.byteLength(JSON.stringify(projection)) >
    PAPER_PACKAGE_LIMITS.projectionBytes
  )
    return packageFailure("This Word edit has too much text to read safely.")
  const sidecar = rebound.sidecar()
  return persistWordPackage(
    owner,
    {
      basis: {
        docId: version.docId,
        incarnation: version.incarnation,
        revision: version.revision,
        packageHash: version.packageHash,
        sidecarHash: version.sidecarHash,
        projectionHash: version.projectionHash,
        projector: version.projector,
      },
      inputHash: packageDigest(input),
      review: input,
      reviewHash: packageDigest(input),
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
    },
    PAPER_CANVAS_PROFILE,
    true
  )
}

async function commitCanvas(owner: string, input: PaperCanvasCommit) {
  if (input.op === "mint") return mintPage(owner)
  const prepared = await prepareCanvas(owner, input)
  const published = await transaction(() =>
    commitWordCandidate(owner, input, {
      candidate: prepared.candidate,
      review: prepared.review,
    })
  )
  return resultOf(owner, published.docId, published.revision, published.restore)
}

export function registerCanvasCommit(registry: Registry) {
  registry.addCommand(
    {
      name: "paper.canvas",
      description: "Write on the blank page.",
      input: paperCanvasCommitSchema,
      coach: "never",
      destructive: false,
      idempotency: "keyed",
      transaction: "none",
      reversal: (_input, output: CanvasResult) =>
        output.restore
          ? {
              command: "paper.restoreWord",
              input: {
                docId: output.docId,
                candidate: output.restore,
                expectedRevision: output.revision,
              },
              expect: {
                query: "paper.read",
                input: { docId: output.docId },
                matches: { revision: output.revision },
                skipped:
                  "This Word document changed after the edit, so Undo was skipped.",
              },
            }
          : null,
      step: () => "Write on the page",
      activity: (_input, output: CanvasResult) => ({
        subjectKind: "paper",
        subjectId: output.docId,
        summary: "Wrote on the page",
      }),
    },
    async (input, actor) => {
      requireEnabled()
      return commitCanvas(actor.userId, input)
    }
  )
}
