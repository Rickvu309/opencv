import { z } from "zod"
import { idResult, type JobId } from "../../../ids.js"
import { jobRemoveChecklistItemInputSchema, jobResource } from "../../../job.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "job",
  name: "job.removeChecklistItem",
  version: 1,
  kind: "command",
  description: "Remove a checklist item.",
  input: jobRemoveChecklistItemInputSchema,
  publicResult: z.object({ id: z.string(), jobId: idResult<JobId>() }).strict(),
  coach: "auto",
  destructive: false,
  idempotency: "keyed",
  writes: (input) => [jobResource(input.jobId)],
})
