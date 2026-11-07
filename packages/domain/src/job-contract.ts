import { z } from "zod"

import {
  commandContract,
  commandEntry,
  queryContract,
  queryEntry,
} from "./contract.js"
import { jobIdSchema, paperIdSchema, type JobId } from "./ids.js"
import {
  jobAddChecklistItemInputSchema,
  jobAddNoteInputSchema,
  jobCreateInputSchema,
  jobDeleteInputSchema,
  jobLinkPaperInputSchema,
  jobMoveInputSchema,
  jobPatchSchema,
  jobViewSchema,
  jobRemoveChecklistItemInputSchema,
  jobSetChecklistItemInputSchema,
  jobStageSchema,
  jobStarInputSchema,
  jobUnlinkPaperInputSchema,
  jobUpdateInputSchema,
} from "./job.js"
import type { QueryRef } from "./queries.js"

import { jobPriorityResource } from "./resources.js"

const linkedPaperSchema = z
  .object({ id: paperIdSchema, name: z.string() })
  .strict()
  .nullable()

const jobChecklistItemSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    done: z.boolean(),
    position: z.string(),
  })
  .strict()

const jobDetailSchema = jobViewSchema
  .extend({
    note: z.string(),
    checklist: z.array(jobChecklistItemSchema),
    linked: z
      .object({ cv: linkedPaperSchema, letter: linkedPaperSchema })
      .strict(),
  })
  .strict()

export type JobDetail = z.output<typeof jobDetailSchema>

const previewFieldsSchema = z
  .object({ title: z.string(), company: z.string(), location: z.string() })
  .strict()

const jobPreviewSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("unreadable"),
      fields: z.object({}).strict(),
      message: z.string(),
    })
    .strict(),
  z
    .object({
      status: z.literal("duplicate"),
      jobId: jobIdSchema,
      stage: jobStageSchema,
      fields: previewFieldsSchema,
    })
    .strict(),
  z
    .object({
      status: z.literal("company-missing"),
      fields: previewFieldsSchema,
    })
    .strict(),
  z
    .object({
      status: z.literal("filled"),
      fields: previewFieldsSchema.extend({ description: z.string() }).strict(),
    })
    .strict(),
])

export type JobPreview = z.output<typeof jobPreviewSchema>

export const jobQueries = queryContract({
  "job.list": queryEntry({
    input: z
      .object({
        stage: jobStageSchema.optional(),
        company: z.string().optional(),
        location: z.string().optional(),
      })
      .strict(),
    output: z.array(jobViewSchema),
  }),
  "job.get": queryEntry({
    input: z.object({ jobId: jobIdSchema }).strict(),
    output: jobDetailSchema,
  }),
  "job.preview": queryEntry({
    input: z
      .object({ url: z.string().optional(), text: z.string().optional() })
      .strict(),
    output: jobPreviewSchema,
  }),
  "job.calendar": queryEntry({
    input: z
      .object({ from: z.string().min(1), to: z.string().min(1) })
      .strict(),
    output: z.array(jobViewSchema),
  }),
})

type OnJob = { jobId: JobId }

const jobFieldsChanged = (input: OnJob): QueryRef[] => [
  { query: "job.list" },
  { query: "job.get", input: { jobId: input.jobId } },
  { query: "job.calendar" },
]

const jobDetailChanged = (input: OnJob): QueryRef[] => [
  { query: "job.get", input: { jobId: input.jobId } },
]

export const jobContract = commandContract({
  "job.create": commandEntry({
    description: "Save a job.",
    input: jobCreateInputSchema,
    output: jobViewSchema.extend({ sourceLabel: z.string() }).strict(),
    coach: "auto",
    destructive: false,
    step: (input) => `Save ${input.title}`,
    invalidates: () => [{ query: "job.list" }, { query: "job.calendar" }],
  }),
  "job.update": commandEntry({
    delegate: "reversibleJob",
    description:
      "Update job fields. Stage changes go through job.move. Priority changes need the person's approval.",
    input: jobUpdateInputSchema,
    writes: (input) => ("priority" in input.patch ? [jobPriorityResource] : []),
    output: jobViewSchema
      .extend({ previousPatch: jobPatchSchema, watched: z.boolean() })
      .strict(),
    coach: "auto",
    destructive: false,
    step: () => "Update the job",
    invalidates: (input) => [
      ...jobFieldsChanged(input),
      { query: "paper.keywordGap", input: { jobId: input.jobId } },
    ],
  }),
  "job.move": commandEntry({
    delegate: "reversibleJob",
    description: "Move a job to a stage. This is the only stage writer.",
    input: jobMoveInputSchema,
    output: jobViewSchema
      .extend({ fromStage: jobStageSchema, fromPosition: z.string() })
      .strict(),
    coach: "confirm",
    destructive: false,
    step: (input) => `Move to ${input.stage}`,
    invalidates: jobFieldsChanged,
  }),
  "job.star": commandEntry({
    description: "Star or unstar a job.",
    input: jobStarInputSchema,
    output: jobViewSchema.extend({ previousStarred: z.boolean() }).strict(),
    coach: "auto",
    destructive: false,
    step: (input) => (input.starred ? "Star the job" : "Unstar the job"),
    invalidates: jobFieldsChanged,
  }),
  "job.delete": commandEntry({
    description: "Delete a job.",
    input: jobDeleteInputSchema,
    output: z.object({ id: jobIdSchema }).strict(),
    coach: "confirm",
    destructive: true,
    step: () => "Delete this job",
    invalidates: (input) => [
      ...jobFieldsChanged(input),
      { query: "paper.keywordGap", input: { jobId: input.jobId } },
    ],
  }),
  "job.addChecklistItem": commandEntry({
    description: "Add an interview checklist item.",
    input: jobAddChecklistItemInputSchema,
    output: z
      .object({
        id: z.string(),
        jobId: jobIdSchema,
        label: z.string(),
        done: z.boolean(),
      })
      .strict(),
    coach: "auto",
    destructive: false,
    step: () => "Add a checklist item",
    invalidates: jobDetailChanged,
  }),
  "job.setChecklistItem": commandEntry({
    description: "Mark a checklist item done or not done.",
    input: jobSetChecklistItemInputSchema,
    output: z
      .object({
        id: z.string(),
        jobId: jobIdSchema,
        done: z.boolean(),
        previousDone: z.boolean(),
      })
      .strict(),
    coach: "auto",
    destructive: false,
    step: () => "Update a checklist item",
    invalidates: jobDetailChanged,
  }),
  "job.removeChecklistItem": commandEntry({
    description: "Remove a checklist item.",
    input: jobRemoveChecklistItemInputSchema,
    output: z.object({ id: z.string(), jobId: jobIdSchema }).strict(),
    coach: "auto",
    destructive: false,
    step: () => "Remove a checklist item",
    invalidates: jobDetailChanged,
  }),
  "job.addNote": commandEntry({
    description: "Add a note. The activity row is the note.",
    input: jobAddNoteInputSchema,
    output: z.object({ jobId: jobIdSchema, body: z.string() }).strict(),
    coach: "auto",
    destructive: false,
    step: () => "Add a note",
    invalidates: jobDetailChanged,
  }),
  "job.linkPaper": commandEntry({
    description: "Attach a CV or letter to a job.",
    input: jobLinkPaperInputSchema,
    output: jobViewSchema
      .extend({ previousDocId: paperIdSchema.nullable(), docName: z.string() })
      .strict(),
    coach: "auto",
    destructive: false,
    step: (input) => `Link the ${input.kind}`,
    invalidates: jobFieldsChanged,
  }),
  "job.unlinkPaper": commandEntry({
    description: "Detach a CV or letter from a job.",
    input: jobUnlinkPaperInputSchema,
    output: jobViewSchema,
    coach: "auto",
    destructive: false,
    step: (input) => `Unlink the ${input.kind}`,
    invalidates: jobFieldsChanged,
  }),
})

export type JobContract = typeof jobContract
