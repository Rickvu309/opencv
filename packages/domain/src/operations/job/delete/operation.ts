import { z } from "zod"
import { idResult, type JobId } from "../../../ids.js"
import { jobDeleteInputSchema, jobResource } from "../../../job.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "job",
  name: "job.delete",
  version: 1,
  kind: "command",
  description: "Delete a job.",
  input: jobDeleteInputSchema,
  publicResult: z.object({ id: idResult<JobId>() }).strict(),
  coach: "confirm",
  destructive: true,
  idempotency: "keyed",
  writes: (input) => [jobResource(input.jobId)],
})
