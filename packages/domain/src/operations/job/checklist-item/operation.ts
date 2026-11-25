import { z } from "zod"
import { jobIdSchema } from "../../../ids.js"
import { jobResource } from "../../../apply/job.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "job",
  name: "job.checklistItem",
  version: 1,
  kind: "read",
  description: "Read one checklist item of a job.",
  input: z.object({ jobId: jobIdSchema, itemId: z.string().min(1) }).strict(),
  publicResult: z
    .object({ id: z.string(), label: z.string(), done: z.boolean() })
    .strip(),
  coach: "never",
  delegate: "jobRead",
  dependsOn: (input) => [jobResource(input.jobId)],
})
