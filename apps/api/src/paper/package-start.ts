import { randomUUID } from "node:crypto"

import {
  PAPER_CANVAS_PROFILE,
  PAPER_START_BOUNDS,
  PAPER_START_TEMPLATE,
  paperContract,
  paperDocNameSchema,
  paperPackageEditResultSchema,
  type PaperStartInput,
} from "@workspace/domain"
import { z } from "zod"

import { paperPackageVersions } from "../db/schema.js"
import type { ReviewedCommand, RowBasis } from "../registry/frozen-review.js"
import type { Registry } from "../registry/registry.js"
import { resultOf } from "./package-canvas.js"
import { packageFailure } from "./package-pages.js"
import { publishWordPackage, stageWordPackage } from "./package-store.js"
import { blankPageBytes } from "./word/mutate.js"
import {
  templateLines,
  templatePageBytes,
  templatePageName,
  type TemplateLine,
} from "./word/template.js"

type StartResult = ReturnType<typeof paperPackageEditResultSchema.parse>

const jobNamesSchema = z.object({ company: z.string() })

export function startedLines(input: PaperStartInput): TemplateLine[] {
  const lines =
    input.kind === "cv"
      ? templateLines(input.templateId ?? PAPER_START_TEMPLATE)
      : []
  if (
    lines.length > PAPER_START_BOUNDS.lines ||
    lines.some((line) => line.text.length > PAPER_START_BOUNDS.lineLength)
  )
    return packageFailure(
      "This template is longer than a new page may start. No document was made."
    )
  return lines
}

function startedBytes(input: PaperStartInput) {
  if (input.kind === "letter") return blankPageBytes()
  startedLines(input)
  return templatePageBytes(input.templateId ?? PAPER_START_TEMPLATE)
}

export function startedName(input: PaperStartInput, company: string | null) {
  if (input.name)
    return /\.docx$/i.test(input.name) ? input.name : `${input.name}.docx`
  const base =
    input.kind === "cv"
      ? templatePageName(input.templateId ?? PAPER_START_TEMPLATE).replace(
          /\.docx$/i,
          ""
        )
      : "Cover letter"
  const named = company?.trim() ? `${base}, ${company.trim()}.docx` : null
  return named && paperDocNameSchema.safeParse(named).success
    ? named
    : `${base}.docx`
}

const candidateSchema = z
  .object({
    stageId: z.string().uuid(),
    owner: z.string(),
    packageHash: z.string(),
  })
  .strict()

type StartCandidate = z.infer<typeof candidateSchema>

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

function paperStartReview(
  registry: Registry
): ReviewedCommand<
  PaperStartInput,
  StartResult,
  StartCandidate,
  z.infer<typeof reviewSchema>
> {
  return {
    version: "paper-start-1",
    candidate: candidateSchema,
    review: reviewSchema,
    basis: stagedBasis,
    prepare: async (input, actor) => {
      const company = input.jobId
        ? jobNamesSchema.parse(
            await registry.read("job.get", { jobId: input.jobId }, actor)
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
        return packageFailure(
          "This new page is not available. No document was made."
        )
    },
    commit: async (input, prepared, actor) => {
      if (prepared.candidate.owner !== actor.userId)
        return packageFailure(
          "This new page is not available. No document was made."
        )
      const published = await publishWordPackage(
        actor.userId,
        prepared.candidate.stageId,
        PAPER_CANVAS_PROFILE
      )
      if (input.jobId)
        await registry.execute({
          name: "job.linkPaper",
          input: {
            jobId: input.jobId,
            docId: published.docId,
            kind: input.kind,
          },
          actor,
        })
      return resultOf(actor.userId, published.docId, published.revision, null)
    },
  }
}

export function registerPaperStart(
  registry: Registry,
  entry: (typeof paperContract)["paper.start"]
) {
  registry.addReviewedCommand(
    {
      name: "paper.start",
      description: entry.description,
      input: entry.input,
      coach: entry.coach,
      destructive: entry.destructive,
      idempotency: "keyed",
      reversal: () => null,
      step: entry.step,
      activity: (_input, output: StartResult) => ({
        subjectKind: "paper",
        subjectId: output.docId,
        summary: `Started ${output.name}`,
      }),
    },
    paperStartReview(registry)
  )
}
