import { z } from "zod"
import {
  jobCreateInputSchema,
  jobResource,
  jobResultSchema,
} from "../../../apply/job.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "job",
  name: "job.create",
  version: 1,
  kind: "command",
  description: "Save a job.",
  input: jobCreateInputSchema,
  publicResult: jobResultSchema.extend({ sourceLabel: z.string() }).strip(),
  coach: "auto",
  destructive: false,
  idempotency: "keyed",
  writes: () => [jobResource()],
})
