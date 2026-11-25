import {
  jobResource,
  jobResultSchema,
  jobUnlinkPaperInputSchema,
} from "../../../apply/job.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "job",
  name: "job.unlinkPaper",
  version: 1,
  kind: "command",
  description: "Detach a CV or letter from a job.",
  input: jobUnlinkPaperInputSchema,
  publicResult: jobResultSchema,
  coach: "auto",
  destructive: false,
  idempotency: "keyed",
  writes: (input) => [jobResource(input.jobId)],
})
