import { z } from "zod"
import {
  jobLinkPaperInputSchema,
  jobResource,
  jobResultSchema,
} from "../../../job.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "job",
  name: "job.linkPaper",
  version: 1,
  kind: "command",
  description: "Attach a CV or letter to a job.",
  input: jobLinkPaperInputSchema,
  publicResult: jobResultSchema.extend({ docName: z.string() }).strip(),
  coach: "auto",
  destructive: false,
  idempotency: "keyed",
  writes: (input) => [jobResource(input.jobId)],
})
