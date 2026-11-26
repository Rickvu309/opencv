import { z } from "zod"
import { idResult, type JobId } from "../../../ids.js"
import {
  jobAddChecklistItemInputSchema,
  jobResource,
} from "../../../apply/job.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "job",
  name: "job.addChecklistItem",
  version: 1,
  kind: "command",
  description: "Add an interview checklist item.",
  label: "Add a Job checklist item",
  input: jobAddChecklistItemInputSchema,
  publicResult: z
    .object({
      id: z.string(),
      jobId: idResult<JobId>(),
      label: z.string(),
      done: z.boolean(),
    })
    .strip(),
  coach: "auto",
  coachPermission: "agentInterview",
  destructive: false,
  idempotency: "keyed",
  writes: (input) => [jobResource(input.jobId)],
})
