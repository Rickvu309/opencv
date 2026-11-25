import {
  jobMoveInputSchema,
  jobResource,
  jobResultSchema,
  jobStageSchema,
} from "../../../apply/job.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "job",
  name: "job.move",
  version: 1,
  kind: "command",
  description: "Move a job to a stage. This is the only stage writer.",
  input: jobMoveInputSchema,
  publicResult: jobResultSchema.extend({ fromStage: jobStageSchema }).strip(),
  coach: "confirm",
  delegate: "reversibleJob",
  destructive: false,
  idempotency: "keyed",
  writes: (input) => [jobResource(input.jobId)],
})
