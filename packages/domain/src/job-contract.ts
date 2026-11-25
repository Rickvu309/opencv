import { z } from "zod"

import { commandContract, commandEntry } from "./contract.js"
import { jobIdSchema, paperIdSchema } from "./ids.js"
import {
  jobAddChecklistItemInputSchema,
  jobCreateInputSchema,
  jobLinkPaperInputSchema,
  jobMoveInputSchema,
  jobPatchSchema,
  jobViewSchema,
  jobSetChecklistItemInputSchema,
  jobStageSchema,
  jobUpdateInputSchema,
} from "./job.js"

import { jobPriorityResource } from "./resources.js"

export const jobContract = commandContract({
  "job.create": commandEntry({
    description: "Save a job.",
    input: jobCreateInputSchema,
    output: jobViewSchema.extend({ sourceLabel: z.string() }).strict(),
    coach: "auto",
    destructive: false,
    step: (input) => `Save ${input.title}`,
    invalidates: () => [],
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
    invalidates: () => [],
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
    invalidates: () => [],
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
    invalidates: () => [],
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
    invalidates: () => [],
  }),
})

export type JobContract = typeof jobContract
