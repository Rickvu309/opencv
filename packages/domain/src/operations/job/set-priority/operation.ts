import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import { jobIdSchema } from "../../../ids.js"
import { jobPrioritySchema, jobViewSchema } from "../../../job.js"
import { jobPriorityResource } from "../../../resources.js"

export const operation = defineOperation({
  owner: "job",
  name: "job.setPriority",
  version: 1,
  kind: "command",
  description: "Set a job's priority.",
  input: z.object({ jobId: jobIdSchema, priority: jobPrioritySchema }).strict(),
  publicResult: jobViewSchema
    .extend({
      id: z.string().uuid(),
      cvDocId: z.string().uuid().nullable(),
      letterDocId: z.string().uuid().nullable(),
    })
    .strip(),
  coach: "confirm",
  delegate: "reversibleJob",
  destructive: false,
  idempotency: "keyed",
  writes: (input: { jobId: string }) => [
    { ...jobPriorityResource, entityId: input.jobId },
    { name: "job", entityId: input.jobId, coachFloor: "auto" },
  ],
})
