import { catalog, jobContract, type Actor, type Plan } from "@workspace/domain"

import { bindCommands } from "../registry/bind.js"
import type { Registry } from "../registry/registry.js"
import { moveJob } from "./board.js"
import { fetchJobPosting, type FetchJobPosting } from "./fetch-posting.js"
import { linkPaper } from "./linked-papers.js"
import { previewJob } from "./preview.js"

type ReadPostingOnPlan = (input: {
  plan: Plan
  text: string
}) => Promise<{ title: string; company: string; location: string } | null>

export type JobPreviewOptions = {
  fetch?: FetchJobPosting
  interpret?: ReadPostingOnPlan | null
}

const posting: {
  fetch: FetchJobPosting
  read: ReadPostingOnPlan | null
} = { fetch: fetchJobPosting, read: null }

const registeredOn = new WeakSet<Registry>()

function planOf(profile: unknown): Plan | null {
  if (!profile || typeof profile !== "object" || !("plan" in profile))
    return null
  return profile.plan === "free" || profile.plan === "pro" ? profile.plan : null
}

export function previewPosting(
  actor: Actor,
  input: { url?: string; text?: string },
  registry: Registry
) {
  return previewJob(
    actor,
    input,
    posting.fetch,
    posting.read
      ? async (text) => {
          const plan = planOf(
            await registry.read(catalog["profile.get"].name, {}, actor)
          )
          return plan && posting.read ? posting.read({ plan, text }) : null
        }
      : undefined
  )
}

export function registerJob(registry: Registry, options?: JobPreviewOptions) {
  if (options?.fetch) posting.fetch = options.fetch
  if (options && "interpret" in options)
    posting.read = options.interpret ?? null
  if (registeredOn.has(registry)) return
  registeredOn.add(registry)

  bindCommands(registry, jobContract, {
    "job.move": {
      handler: (input, actor) =>
        moveJob(actor, input.jobId, input.stage, input.position),
      reversal: (input, output) => ({
        command: "job.move",
        input: {
          jobId: input.jobId,
          stage: output.fromStage,
          position: output.fromPosition,
        },
        expect: {
          query: "job.get",
          input: { jobId: input.jobId },
          matches: {
            stage: output.stage,
            position: output.position,
          },
          skipped: "This card moved again, so Undo was skipped",
        },
      }),
      activity: (input) => ({
        subjectKind: "job",
        subjectId: input.jobId,
        summary: `You moved it to ${input.stage}`,
      }),
    },
    "job.linkPaper": {
      handler: (input, actor) =>
        linkPaper(actor, input.jobId, input.docId, input.kind),
      reversal: (input, output) =>
        output.previousDocId
          ? {
              command: "job.linkPaper",
              input: {
                jobId: input.jobId,
                docId: output.previousDocId,
                kind: input.kind,
              },
            }
          : {
              command: "job.unlinkPaper",
              input: { jobId: input.jobId, kind: input.kind },
            },
      activity: (input, output) => ({
        subjectKind: "job",
        subjectId: input.jobId,
        summary: `You linked ${output.docName}`,
      }),
    },
  })
}
