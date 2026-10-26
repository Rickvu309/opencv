import {
  defineQuery,
  jobIdSchema,
  jobAddChecklistItemInputSchema,
  jobAddNoteInputSchema,
  jobCreateInputSchema,
  jobDeleteInputSchema,
  jobLinkPaperInputSchema,
  jobMoveInputSchema,
  jobRemoveChecklistItemInputSchema,
  jobSetChecklistItemInputSchema,
  jobStarInputSchema,
  jobUnlinkPaperInputSchema,
  jobUpdateInputSchema,
  type Actor,
  type JobAddChecklistItemInput,
  type Plan,
  type JobCreateInput,
  type JobLinkPaperInput,
  type JobMoveInput,
  type JobSetChecklistItemInput,
  type JobStage,
  type JobStarInput,
  type JobUpdateInput,
} from "@workspace/domain"
import { z } from "zod"

import type { FetchJobPosting } from "../apply/fetch-posting.js"
import { fetchJobPosting } from "../apply/fetch-posting.js"
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

const listInput = z
  .object({
    stage: z
      .enum(["saved", "applied", "interview", "offer", "closed"])
      .optional(),
    company: z.string().optional(),
    location: z.string().optional(),
  })
  .strict()

const idInput = z.object({ jobId: jobIdSchema }).strict()

const previewInput = z
  .object({
    url: z.string().optional(),
    text: z.string().optional(),
  })
  .strict()

const calendarInput = z
  .object({
    from: z.string().min(1),
    to: z.string().min(1),
  })
  .strict()

export function registerJob(registry: Registry, options?: JobPreviewOptions) {
  if (options?.fetch) previewOptions.fetch = options.fetch
  if (options && "interpret" in options) {
    previewOptions.interpret = options.interpret ?? null
  }
  if (commandsAdded) return
  commandsAdded = true

  registry.addCommand(
    {
      name: "job.create",
      description: "Save a job.",
      input: jobCreateInputSchema,
      coach: "auto",
      destructive: false,
      reversal: (_input, output) => ({
        command: "job.delete",
        input: { jobId: output.id },
      }),
      step: (input) => `Save ${input.title}`,
      activity: (_input, output) => ({
        subjectKind: "job",
        subjectId: output.id,
        summary: `You added this job from ${output.sourceLabel}`,
      }),
    },
    (input: JobCreateInput, actor: Actor) => createJob(actor, input)
  )

  registry.addCommand(
    {
      name: "job.update",
      description: "Update job fields. Stage changes go through job.move.",
      input: jobUpdateInputSchema,
      coach: "auto",
      destructive: false,
      reversal: (input, output) => ({
        command: "job.update",
        input: { jobId: input.jobId, patch: output.previousPatch },
      }),
      step: () => "Update the job",
      activity: (input, output) =>
        output.watched
          ? {
              subjectKind: "job",
              subjectId: input.jobId,
              summary: "Updated the job",
            }
          : null,
    },
    (input: JobUpdateInput, actor: Actor) =>
      updateJob(actor, input.jobId, input.patch)
  )

  registry.addCommand(
    {
      name: "job.move",
      description: "Move a job to a stage. This is the only stage writer.",
      input: jobMoveInputSchema,
      coach: "confirm",
      destructive: false,
      reversal: (input, output) => ({
        command: "job.move",
        input: {
          jobId: input.jobId,
          stage: output.fromStage,
          position: output.fromPosition,
        },
      }),
      step: (input) => `Move to ${input.stage}`,
      activity: (input) => ({
        subjectKind: "job",
        subjectId: input.jobId,
        summary: `You moved it to ${input.stage}`,
      }),
    },
    (input: JobMoveInput, actor: Actor) =>
      moveJob(actor, input.jobId, input.stage as JobStage, input.position)
  )

  registry.addCommand(
    {
      name: "job.star",
      description: "Star or unstar a job.",
      input: jobStarInputSchema,
      coach: "auto",
      destructive: false,
      reversal: (input, output) => ({
        command: "job.star",
        input: { jobId: input.jobId, starred: output.previousStarred },
      }),
      step: (input) => (input.starred ? "Star the job" : "Unstar the job"),
      activity: () => null,
    },
    (input: JobStarInput, actor: Actor) =>
      starJob(actor, input.jobId, input.starred)
  )

  registry.addCommand(
    {
      name: "job.delete",
      description: "Delete a job.",
      input: jobDeleteInputSchema,
      coach: "confirm",
      destructive: true,
      reversal: () => null,
      step: () => "Delete this job",
      activity: () => null,
    },
    (input, actor) => deleteJob(actor, input.jobId)
  )

  registry.addCommand(
    {
      name: "job.addChecklistItem",
      description: "Add an interview checklist item.",
      input: jobAddChecklistItemInputSchema,
      coach: "auto",
      destructive: false,
      reversal: (_input, output) => ({
        command: "job.removeChecklistItem",
        input: { jobId: output.jobId, itemId: output.id },
      }),
      step: () => "Add a checklist item",
      activity: () => null,
    },
    (input: JobAddChecklistItemInput, actor: Actor) =>
      addChecklistItem(actor, input.jobId, input.label)
  )

  registry.addCommand(
    {
      name: "job.setChecklistItem",
      description: "Mark a checklist item done or not done.",
      input: jobSetChecklistItemInputSchema,
      coach: "auto",
      destructive: false,
      reversal: (input, output) => ({
        command: "job.setChecklistItem",
        input: {
          jobId: input.jobId,
          itemId: input.itemId,
          done: output.previousDone,
        },
      }),
      step: () => "Update a checklist item",
      activity: () => null,
    },
    (input: JobSetChecklistItemInput, actor: Actor) =>
      setChecklistItem(actor, input.jobId, input.itemId, input.done)
  )

  registry.addCommand(
    {
      name: "job.removeChecklistItem",
      description: "Remove a checklist item.",
      input: jobRemoveChecklistItemInputSchema,
      coach: "auto",
      destructive: false,
      reversal: () => null,
      step: () => "Remove a checklist item",
      activity: () => null,
    },
    (input, actor) => removeChecklistItem(actor, input.jobId, input.itemId)
  )

  registry.addCommand(
    {
      name: "job.addNote",
      description: "Add a note. The activity row is the note.",
      input: jobAddNoteInputSchema,
      coach: "auto",
      destructive: false,
      reversal: () => null,
      step: () => "Add a note",
      activity: (input) => ({
        subjectKind: "job",
        subjectId: input.jobId,
        summary: input.body,
      }),
    },
    async (input, actor) => {
      await ownedJob(actor.userId, input.jobId)
      return { jobId: input.jobId, body: input.body }
    }
  )

  registry.addCommand(
    {
      name: "job.linkPaper",
      description: "Attach a CV or letter to a job.",
      input: jobLinkPaperInputSchema,
      coach: "auto",
      destructive: false,
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
      step: (input) => `Link the ${input.kind}`,
      activity: () => null,
    },
    (input: JobLinkPaperInput, actor: Actor) =>
      linkPaper(actor, input.jobId, input.docId, input.kind)
  )

  registry.addCommand(
    {
      name: "job.unlinkPaper",
      description: "Detach a CV or letter from a job.",
      input: jobUnlinkPaperInputSchema,
      coach: "auto",
      destructive: false,
      reversal: () => null,
      step: (input) => `Unlink the ${input.kind}`,
      activity: () => null,
    },
    (input, actor) => unlinkPaper(actor, input.jobId, input.kind)
  )

  registry.addQuery(
    defineQuery({
      name: "job.list",
      description: "List jobs.",
      input: listInput,
      coach: true,
      step: () => "List jobs",
      read: (input, actor) => listJobs(actor.userId, input),
    })
  )

  registry.addQuery(
    defineQuery({
      name: "job.get",
      description: "Read one job.",
      input: idInput,
      coach: true,
      step: () => "Read the job",
      read: (input, actor) => getJob(actor.userId, input.jobId),
    })
  )

  registry.addQuery(
    defineQuery({
      name: "job.preview",
      description: "Preview a posting without saving it.",
      input: previewInput,
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
    defineQuery({
      name: "job.calendar",
      description: "List jobs with an interview or deadline in a range.",
      input: calendarInput,
      coach: true,
      step: () => "Read the calendar",
      read: (input, actor) => calendarJobs(actor.userId, input.from, input.to),
    })
  )
}
