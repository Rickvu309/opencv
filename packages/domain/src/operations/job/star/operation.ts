import {
  jobResource,
  jobResultSchema,
  jobStarInputSchema,
} from "../../../apply/job.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "job",
  name: "job.star",
  version: 1,
  kind: "command",
  description: "Star or unstar a job.",
  input: jobStarInputSchema,
  publicResult: jobResultSchema,
  coach: "auto",
  destructive: false,
  idempotency: "keyed",
  writes: (input) => [jobResource(input.jobId)],
})
