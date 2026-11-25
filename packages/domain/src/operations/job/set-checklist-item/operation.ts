import { z } from "zod"
import { idResult, type JobId } from "../../../ids.js"
import {
  jobResource,
  jobSetChecklistItemInputSchema,
} from "../../../apply/job.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "job",
  name: "job.setChecklistItem",
  version: 1,
  kind: "command",
  description: "Mark a checklist item done or not done.",
  input: jobSetChecklistItemInputSchema,
  publicResult: z
    .object({ id: z.string(), jobId: idResult<JobId>(), done: z.boolean() })
    .strip(),
  coach: "auto",
  destructive: false,
  idempotency: "keyed",
  writes: (input) => [jobResource(input.jobId)],
})
