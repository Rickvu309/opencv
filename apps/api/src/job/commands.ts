import { jobContract, type Plan } from "@workspace/domain"
import type { FetchJobPosting } from "../apply/fetch-posting.js"
import { fetchJobPosting } from "../apply/fetch-posting.js"
import { bindCommands, tableQuery } from "../registry/bind.js"
import type { Registry } from "../registry/registry.js"
import {
  addChecklistItem,
  calendarJobs,
  createJob,
  deleteJob,
  getJob,
  linkPaper,
  listJobs,
  moveJob,
  ownedJob,
  previewJob,
  removeChecklistItem,
  setChecklistItem,
  starJob,
  unlinkPaper,
  updateJob,
} from "./store.js"

type PostingFields = { title: string; company: string; location: string }

type PostingInterpret = (input: {
  plan: Plan
  text: string
}) => Promise<PostingFields | null>

export type JobPreviewOptions = {
  fetch?: FetchJobPosting
  interpret?: PostingInterpret | null
}

const previewOptions: {
  fetch: FetchJobPosting
  interpret: PostingInterpret | null
} = {
  fetch: fetchJobPosting,
  interpret: null,
}

let commandsAdded = false

function planFrom(value: unknown): Plan | null {
  if (!value || typeof value !== "object" || !("plan" in value)) return null
  const plan = (value as { plan?: unknown }).plan
  return plan === "free" || plan === "pro" ? plan : null
}

export function registerJob(registry: Registry, options?: JobPreviewOptions) {
  if (options?.fetch) previewOptions.fetch = options.fetch
  if (options && "interpret" in options) {
    previewOptions.interpret = options.interpret ?? null
  }
  if (commandsAdded) return
  commandsAdded = true

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
      handler: (input, actor) => updateJob(actor, input.jobId, input.patch),
      reversal: (input, output) => ({
        command: "job.update",
        input: { jobId: input.jobId, patch: output.previousPatch },
      }),
      activity: (input, output) =>
        output.watched
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
      }),
      activity: (input) => ({
        subjectKind: "job",
        subjectId: input.jobId,
        summary: `You moved it to ${input.stage}`,
      }),
    },
    "job.star": {
      handler: (input, actor) => starJob(actor, input.jobId, input.starred),
      reversal: (input, output) => ({
        command: "job.star",
        input: { jobId: input.jobId, starred: output.previousStarred },
      }),
      activity: () => null,
    },
    "job.delete": {
      handler: (input, actor) => deleteJob(actor, input.jobId),
      reversal: () => null,
      activity: () => null,
    },
    "job.addChecklistItem": {
      handler: (input, actor) =>
        addChecklistItem(actor, input.jobId, input.label),
      reversal: (_input, output) => ({
        command: "job.removeChecklistItem",
        input: { jobId: output.jobId, itemId: output.id },
      }),
      activity: () => null,
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
      activity: () => null,
    },
    "job.removeChecklistItem": {
      handler: (input, actor) =>
        removeChecklistItem(actor, input.jobId, input.itemId),
      reversal: () => null,
      activity: () => null,
    },
    "job.addNote": {
      handler: async (input, actor) => {
        await ownedJob(actor.userId, input.jobId)
        return { jobId: input.jobId, body: input.body }
      },
      reversal: () => null,
      activity: (input) => ({
        subjectKind: "job",
        subjectId: input.jobId,
        summary: input.body,
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
      activity: () => null,
    },
    "job.unlinkPaper": {
      handler: (input, actor) => unlinkPaper(actor, input.jobId, input.kind),
      reversal: () => null,
      activity: () => null,
    },
  })

  registry.addQuery(
    tableQuery("job.list", {
      description: "List jobs.",
      coach: true,
      step: () => "List jobs",
      read: (input, actor) => listJobs(actor.userId, input),
    })
  )

  registry.addQuery(
    tableQuery("job.get", {
      description: "Read one job.",
      coach: true,
      step: () => "Read the job",
      read: (input, actor) => getJob(actor.userId, input.jobId),
    })
  )

  registry.addQuery(
    tableQuery("job.preview", {
      description: "Preview a posting without saving it.",
      coach: true,
      step: () => "Preview the posting",
      read: (input, actor) =>
        previewJob(
          actor,
          input,
          previewOptions.fetch,
          previewOptions.interpret
            ? async (text) => {
                const plan = planFrom(
                  await registry.read("profile.get", {}, actor)
                )
                if (!plan || !previewOptions.interpret) return null
                return previewOptions.interpret({ plan, text })
              }
            : undefined
        ),
    })
  )

  registry.addQuery(
    tableQuery("job.calendar", {
      description: "List jobs with an interview or deadline in a range.",
      coach: true,
      step: () => "Read the calendar",
      read: (input, actor) => calendarJobs(actor.userId, input.from, input.to),
    })
  )
}
