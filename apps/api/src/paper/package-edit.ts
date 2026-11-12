import { randomUUID } from "node:crypto"

import {
  ERROR_CODES,
  paperContract,
  paperPackageEditResultSchema,
  wordUndoSchema,
  type Actor,
} from "@workspace/domain"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { getDb } from "../db/context.js"
import { paperPackageCandidates, paperPackageHeads } from "../db/schema.js"
import { CommandError } from "../registry/errors.js"
import {
  type LockedBasis,
  type ReviewedCommand,
  type RowBasis,
} from "../registry/frozen-review.js"
import type { Registry } from "../registry/registry.js"
import {
  commitWordCandidate,
  persistWordPackage,
  revalidateWordCandidate,
  prepareStoredWordPackage,
} from "./package-candidates.js"
import { packageFailure } from "./package-pages.js"
import { isWordBatch, prepareWordBatch } from "./package-planner.js"
import { PACKAGE_PROFILE } from "./package-profile.js"
import { revalidateUnchangedPackage } from "./package-restore.js"
import { readWordPackage } from "./package-store.js"
import { undo, WORD_UNDO_MOVED } from "./word/document.js"

type EditInput = z.output<(typeof paperContract)["paper.edit"]["input"]>
type EditOutput = z.output<(typeof paperContract)["paper.edit"]["output"]>

const snapshotSchema = z
  .object({
    docId: z.string().uuid(),
    owner: z.string().min(1),
    incarnation: z.string().uuid(),
    revision: z.string().uuid(),
  })
  .strict()
const candidateSchema = z
  .object({
    id: z.string().uuid(),
    digest: z.string().regex(/^[a-f0-9]{64}$/),
    docId: z.string().uuid(),
    owner: z.string().min(1),
    incarnation: z.string().uuid(),
    parentRevision: z.string().uuid(),
    noop: z.literal(true).optional(),
  })
  .strict()
type Snapshot = z.output<typeof snapshotSchema>
type PackageCandidate = z.output<typeof candidateSchema>

const unchangedBasis = {
  table: paperPackageHeads,
  key: [
    {
      column: paperPackageHeads.docId,
      source: "snapshot",
      field: "docId",
    },
    {
      column: paperPackageHeads.userId,
      source: "snapshot",
      field: "owner",
    },
    {
      column: paperPackageHeads.incarnation,
      source: "snapshot",
      field: "incarnation",
    },
  ],
  compared: [
    {
      column: paperPackageHeads.revision,
      source: "snapshot",
      field: "revision",
    },
  ],
} satisfies RowBasis

const mutationBasis = {
  table: paperPackageHeads,
  key: [
    {
      column: paperPackageHeads.docId,
      source: "candidate",
      field: "docId",
    },
    {
      column: paperPackageHeads.userId,
      source: "candidate",
      field: "owner",
    },
    {
      column: paperPackageHeads.incarnation,
      source: "candidate",
      field: "incarnation",
    },
  ],
  compared: [
    {
      column: paperPackageHeads.revision,
      source: "candidate",
      field: "parentRevision",
    },
  ],
} satisfies RowBasis

function unavailable(): never {
  return packageFailure(
    "This saved Word edit is no longer available. No document was changed."
  )
}

function matchesLocked(
  locked: LockedBasis,
  key: readonly unknown[],
  compared: readonly unknown[]
) {
  if (
    locked.key.length !== key.length ||
    locked.compared.length !== compared.length ||
    locked.key.some((value, index) => value !== key[index]) ||
    locked.compared.some((value, index) => value !== compared[index])
  )
    return unavailable()
}

async function packageResult(
  owner: string,
  docId: string,
  incarnation: string,
  revision: string,
  restore: { id: string; digest: string } | null
) {
  const page = await readWordPackage(owner, { docId, at: revision })
  return paperPackageEditResultSchema.parse({
    generation: "package",
    docId,
    revision,
    name: page.name,
    kind: page.kind,
    packageHash: page.packageHash,
    byteSize: page.byteSize,
    incarnation,
    restore,
  })
}

function basisOf(candidate: PackageCandidate) {
  return {
    key: [candidate.docId, candidate.owner, candidate.incarnation] as const,
    expected: [candidate.parentRevision] as const,
  }
}

function isPackageOutput(
  output: EditOutput
): output is z.output<typeof paperPackageEditResultSchema> {
  return "generation" in output && output.generation === "package"
}

async function storedCandidate(owner: string, id: string, digest: string) {
  const [row] = await getDb()
    .select({
      id: paperPackageCandidates.id,
      digest: paperPackageCandidates.digest,
      docId: paperPackageCandidates.docId,
      userId: paperPackageCandidates.userId,
      incarnation: paperPackageCandidates.incarnation,
      basisRevision: paperPackageCandidates.basisRevision,
    })
    .from(paperPackageCandidates)
    .where(eq(paperPackageCandidates.id, id))
  if (!row || row.digest !== digest || row.userId !== owner)
    return unavailable()
  return {
    id: row.id,
    digest: row.digest,
    docId: row.docId,
    owner: row.userId,
    incarnation: row.incarnation,
    parentRevision: row.basisRevision,
  }
}

async function prepareStoredWordBatch(owner: string, input: EditInput) {
  const plan = await prepareWordBatch(owner, input)
  if (plan.kind === "unchanged") return plan
  return persistWordPackage(owner, plan, PACKAGE_PROFILE.version, false)
}

const wordPackageReview: ReviewedCommand<
  EditInput,
  EditOutput,
  PackageCandidate,
  unknown,
  Snapshot
> = {
  version: "paper-package-1",
  candidate: candidateSchema,
  review: z.record(z.string(), z.unknown()),
  unchanged: {
    snapshot: snapshotSchema,
    basis: unchangedBasis,
    revalidate: async (_input, snapshot, actor) => {
      if (snapshot.owner !== actor.userId) return unavailable()
      await revalidateUnchangedPackage(
        snapshot.owner,
        snapshot.docId,
        snapshot.incarnation,
        snapshot.revision
      )
    },
  },
  basis: mutationBasis,
  prepare: async (input, actor) => {
    if (typeof input.basedOn !== "string")
      return packageFailure("This Word edit does not name a saved revision.")
    const plan = isWordBatch(input)
      ? await prepareStoredWordBatch(actor.userId, input)
      : await prepareStoredWordPackage(actor.userId, input)
    if (plan.kind === "unchanged") {
      const snapshot = {
        docId: plan.basis.docId,
        owner: actor.userId,
        incarnation: plan.basis.incarnation,
        revision: plan.basis.revision,
      }
      if (actor.type !== "person") {
        return {
          candidate: {
            id: randomUUID(),
            digest: "0".repeat(64),
            docId: snapshot.docId,
            owner: snapshot.owner,
            incarnation: snapshot.incarnation,
            parentRevision: snapshot.revision,
            noop: true as const,
          },
          review: {
            docId: snapshot.docId,
            basedOn: input.basedOn,
            changes: [],
          },
        }
      }
      return {
        kind: "unchanged" as const,
        snapshot,
        output: await packageResult(
          actor.userId,
          snapshot.docId,
          snapshot.incarnation,
          snapshot.revision,
          null
        ),
      }
    }
    return {
      candidate: await storedCandidate(
        actor.userId,
        plan.candidate.id,
        plan.candidate.digest
      ),
      review: plan.review,
    }
  },
  revalidate: async (input, prepared, actor) => {
    if (prepared.candidate.owner !== actor.userId) return unavailable()
    if (prepared.candidate.noop) {
      await revalidateUnchangedPackage(
        prepared.candidate.owner,
        prepared.candidate.docId,
        prepared.candidate.incarnation,
        prepared.candidate.parentRevision
      )
      return
    }
    await revalidateWordCandidate(actor.userId, input, {
      candidate: {
        id: prepared.candidate.id,
        digest: prepared.candidate.digest,
      },
      review: prepared.review,
    })
  },
  commit: async (input, prepared, actor, locked) => {
    const basis = basisOf(prepared.candidate)
    matchesLocked(locked, basis.key, basis.expected)
    if (prepared.candidate.owner !== actor.userId) return unavailable()
    if (prepared.candidate.noop)
      return packageResult(
        actor.userId,
        prepared.candidate.docId,
        prepared.candidate.incarnation,
        prepared.candidate.parentRevision,
        null
      )
    const published = await commitWordCandidate(actor.userId, input, {
      candidate: {
        id: prepared.candidate.id,
        digest: prepared.candidate.digest,
      },
      review: prepared.review,
    })
    return packageResult(
      actor.userId,
      published.docId,
      published.incarnation,
      published.revision,
      published.restore
    )
  },
}

export function registerWordPackageEdit(
  registry: Registry,
  entry: (typeof paperContract)["paper.edit"],
  execute: (input: EditInput, actor: Actor) => Promise<EditOutput>
) {
  registry.addUndoCommand(
    {
      name: "paper.undoWord",
      description: "Put back the Word page from before one approved edit.",
      input: wordUndoSchema,
      coach: "never",
      destructive: false,
      idempotency: "keyed",
      reversal: () => null,
      step: () => "Undo a Word edit",
      activity: () => null,
    },
    async (input, actor) => {
      const restored = await undo(actor.userId, input)
      if (restored.refused)
        throw new CommandError(ERROR_CODES.CONFLICT, restored.message)
      return { docId: input.doc, revision: restored.page.revision }
    }
  )
  registry.addSelectedCommand(
    {
      name: "paper.edit",
      description: entry.description,
      delegate: entry.delegate,
      input: entry.input,
      coach: entry.coach,
      destructive: entry.destructive,
      idempotency: "keyed",
      step: entry.step,
      reversal: (input, output) => {
        if (isPackageOutput(output)) {
          if (!output.restore || typeof input.basedOn !== "string") return null
          return {
            command: "paper.undoWord",
            input: {
              doc: output.docId,
              revision: output.revision,
              restore: input.basedOn,
            },
            expect: {
              query: "paper.read",
              input: { docId: output.docId },
              matches: { revision: output.revision },
              skipped: WORD_UNDO_MOVED,
            },
          }
        }
        return output.editId
          ? {
              command: "paper.revertEdit",
              input: { docId: input.docId, editId: output.editId },
            }
          : null
      },
      activity: (input, output) => {
        const saved = isPackageOutput(output)
          ? output.restore
            ? output
            : null
          : output.editId
            ? output
            : null
        return saved
          ? {
              subjectKind: "paper",
              subjectId: input.docId,
              summary: `Edited ${saved.name}`,
              detail: { docId: input.docId, name: saved.name },
            }
          : null
      },
    },
    {
      select: (input) =>
        typeof input.basedOn === "number" ? "execute" : "reviewed",
      execute,
      reviewed: wordPackageReview,
    }
  )
}
