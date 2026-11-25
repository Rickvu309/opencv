import { z } from "zod"

import { commandContract, commandEntry } from "./contract.js"
import { paperIdSchema } from "./ids.js"
import {
  jobLinkPaperInputSchema,
  jobMoveInputSchema,
  jobViewSchema,
  jobStageSchema,
} from "./job.js"

export const jobContract = commandContract({
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
