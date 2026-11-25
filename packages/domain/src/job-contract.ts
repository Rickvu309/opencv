import { z } from "zod"

import { commandContract, commandEntry } from "./contract.js"
import { jobMoveInputSchema, jobViewSchema, jobStageSchema } from "./job.js"

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
})

export type JobContract = typeof jobContract
