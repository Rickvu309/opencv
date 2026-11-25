import {
  catalog,
  jobContract,
  jobPriorityResource,
  type Actor,
  type Plan,
} from "@workspace/domain"

import { bindCommands } from "../registry/bind.js"
import type { Registry } from "../registry/registry.js"
import { takePriorityGrant } from "../registry/write-grant.js"
import { createJob, moveJob, updateJob } from "./board.js"
import { addChecklistItem, setChecklistItem } from "./checklist.js"
import { fetchJobPosting, type FetchJobPosting } from "./fetch-posting.js"
import { linkPaper } from "./linked-papers.js"
import { previewJob } from "./preview.js"
import { priorityRevision, writePriority } from "./store.js"

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
    "job.create": {
      handler: (input, actor) => createJob(actor, input),
      reversal: (_input, output) => ({
        command: "job.delete",
        input: { jobId: output.id },
      }),
      activity: (_input, output) => ({
        subjectKind: "job",
        subjectId: output.id,
        summary: `You added this job from ${output.sourceLabel}`,
      }),
    },
    "job.update": {
      writes: (input) =>
        input.patch.priority !== undefined
          ? [{ ...jobPriorityResource, entityId: input.jobId }]
          : [],
      basis: async (input, actor) =>
        input.patch.priority === undefined
          ? null
          : priorityRevision(actor.userId, input.jobId),
      handler: async (input, actor) => {
        const saved = await updateJob(actor, input.jobId, input.patch)
        if (input.patch.priority === undefined) return saved
        const written = await writePriority(
          takePriorityGrant(input.jobId),
          input.jobId,
          input.patch.priority
        )
        const { previousPriority, ...job } = written
        void previousPriority
        return {
          ...job,
          previousPatch: saved.previousPatch,
          watched: saved.watched,
        }
      },
      reversal: (input, output) => ({
        command: "job.update",
        input: { jobId: input.jobId, patch: output.previousPatch },
      }),
      activity: (input, output, actor) =>
        output.watched || actor.type === "delegate"
          ? {
              subjectKind: "job",
              subjectId: input.jobId,
              summary: "Updated the job",
            }
          : null,
    },
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
    "job.addChecklistItem": {
      handler: (input, actor) =>
        addChecklistItem(actor, input.jobId, input.label),
      reversal: (_input, output) => ({
        command: "job.removeChecklistItem",
        input: { jobId: output.jobId, itemId: output.id },
      }),
      activity: (_input, output) => ({
        subjectKind: "job",
        subjectId: output.jobId,
        summary: `You added "${output.label}" to the checklist`,
      }),
    },
    "job.setChecklistItem": {
      handler: (input, actor) =>
        setChecklistItem(actor, input.jobId, input.itemId, input.done),
      reversal: (input, output) => ({
        command: "job.setChecklistItem",
        input: {
          jobId: input.jobId,
          itemId: input.itemId,
          done: output.previousDone,
        },
      }),
      activity: (_input, output) => ({
        subjectKind: "job",
        subjectId: output.jobId,
        summary: output.done
          ? "You ticked a checklist item"
          : "You unticked a checklist item",
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
