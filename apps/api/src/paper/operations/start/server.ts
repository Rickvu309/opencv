import { randomUUID } from "node:crypto"

import { catalog, parseJobId } from "@workspace/domain/kernel"
import {
  PAPER_CANVAS_PROFILE,
  paperPackageEditResultSchema,
} from "@workspace/domain/paper-doc"
import { operation } from "@workspace/domain/operations/paper/start"
import { z } from "zod"

import { paperPackageVersions } from "../../../db/schema.js"
import type { OperationBinding } from "../../../registry/bind.js"
import type { RowBasis } from "../../../registry/frozen-review.js"
import { resultOf } from "../../word-package/package-canvas.js"
<<<<<<< HEAD
import { packageFailure } from "../../word-package/package-pages.js"
=======
import { packageFailure } from "../../package-pages.js"
>>>>>>> origin/main
import { startedBytes, startedName } from "../../word-package/package-start.js"
import {
  publishWordPackage,
  stageWordPackage,
} from "../../word-package/package-store.js"

type StartResult = z.output<typeof paperPackageEditResultSchema>

const jobNamesSchema = z.object({ company: z.string() })

const candidateSchema = z
  .object({
    stageId: z.string().uuid(),
    owner: z.string(),
    packageHash: z.string(),
  })
  .strict()

const reviewSchema = z
  .object({ kind: z.enum(["cv", "letter"]), name: z.string() })
  .strict()

const stagedBasis = {
  table: paperPackageVersions,
  key: [
    {
      column: paperPackageVersions.revision,
      source: "candidate",
      field: "stageId",
    },
    {
      column: paperPackageVersions.userId,
      source: "candidate",
      field: "owner",
    },
  ],
  compared: [
    {
      column: paperPackageVersions.packageHash,
      source: "candidate",
      field: "packageHash",
    },
  ],
} satisfies RowBasis

const unavailable = "This new page is not available. No document was made."

export const implementation = {
  operation,
  reviewed: {
    version: "paper-start-1",
    candidate: candidateSchema,
    review: reviewSchema,
    basis: stagedBasis,
    prepare: async (input, actor, registry) => {
      const company = input.jobId
        ? jobNamesSchema.parse(
            await registry.read(
              catalog["job.get"].name,
              { jobId: parseJobId(input.jobId) },
              actor
            )
          ).company
        : null
      const name = startedName(input, company)
      const stage = await stageWordPackage(
        actor.userId,
        { requestId: randomUUID(), name, kind: input.kind },
        startedBytes(input)
      )
      return {
        candidate: {
          stageId: stage.stageId,
          owner: actor.userId,
          packageHash: stage.packageHash,
        },
        review: { kind: input.kind, name },
      }
    },
    revalidate: async (_input, prepared, actor) => {
      if (prepared.candidate.owner !== actor.userId)
        return packageFailure(unavailable)
    },
    commit: async (input, prepared, actor, _locked, registry) => {
      if (prepared.candidate.owner !== actor.userId)
        return packageFailure(unavailable)
      const published = await publishWordPackage(
        actor.userId,
        prepared.candidate.stageId,
        PAPER_CANVAS_PROFILE
      )
      if (input.jobId)
        await registry.execute({
          name: catalog["job.linkPaper"].name,
          input: {
            jobId: parseJobId(input.jobId),
            docId: published.docId,
            kind: input.kind,
          },
          actor,
        })
      return resultOf(actor.userId, published.docId, published.revision, null)
    },
  },
  reversal: {
    irreversible: "A started Word page is deleted from the library instead.",
  },
  activity: (_input, output) => ({
    subjectKind: "paper",
    subjectId: output.docId,
    summary: `Started ${output.name}`,
  }),
} satisfies OperationBinding<
  typeof operation,
  StartResult,
  z.output<typeof candidateSchema>,
  z.output<typeof reviewSchema>
>
