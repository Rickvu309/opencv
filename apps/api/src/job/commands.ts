import { jobContract, jobPriorityResource, type Plan } from "@workspace/domain"

import { bindCommands, tableQuery } from "../registry/bind.js"
import type { Registry } from "../registry/registry.js"
import { takePriorityGrant } from "../registry/write-grant.js"
import {
  calendarJobs,
  createJob,
  deleteJob,
  getJob,
  listJobs,
  moveJob,
  starJob,
  updateJob,
} from "./board.js"
import {
  addChecklistItem,
  removeChecklistItem,
  setChecklistItem,
} from "./checklist.js"
import { fetchJobPosting, type FetchJobPosting } from "./fetch-posting.js"
import { linkPaper, unlinkPaper } from "./linked-papers.js"
import { previewJob } from "./preview.js"
import { ownedJob, writePriority } from "./store.js"

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
    "job.star": {
      handler: (input, actor) => starJob(actor, input.jobId, input.starred),
      reversal: (input, output) => ({
        command: "job.star",
        input: { jobId: input.jobId, starred: output.previousStarred },
      }),
      activity: (input) => ({
        subjectKind: "job",
        subjectId: input.jobId,
        summary: input.starred ? "You starred it" : "You unstarred it",
      }),
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
      activity: (input, output) => ({
        subjectKind: "job",
        subjectId: input.jobId,
        summary: `You linked ${output.docName}`,
      }),
    },
    "job.unlinkPaper": {
      handler: (input, actor) => unlinkPaper(actor, input.jobId, input.kind),
      reversal: () => null,
      activity: () => null,
    },
  })

  registry.addQuery(
    tableQuery("job.list", {
      delegate: "jobRead",
      description: "List jobs.",
      coach: true,
      step: () => "List jobs",
      read: (input, actor) => listJobs(actor.userId, input),
    })
  )

  registry.addQuery(
    tableQuery("job.get", {
      delegate: "jobRead",
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
          posting.fetch,
          posting.read
            ? async (text) => {
                const plan = planOf(
                  await registry.read("profile.get", {}, actor)
                )
                return plan && posting.read
                  ? posting.read({ plan, text })
                  : null
              }
            : undefined
        ),
    })
  )

  registry.addQuery(
    tableQuery("job.calendar", {
      delegate: "jobRead",
      description: "List jobs with an interview or deadline in a range.",
      coach: true,
      step: () => "Read the calendar",
      read: (input, actor) => calendarJobs(actor.userId, input.from, input.to),
    })
  )
}
