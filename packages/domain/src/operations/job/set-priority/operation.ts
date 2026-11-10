import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import { jobIdSchema, type JobId, type PaperId } from "../../../ids.js"
import { jobPrioritySchema, jobViewSchema } from "../../../job.js"
import { jobPriorityResource } from "../../../resources.js"

const jobIdResult = z.string().uuid() as unknown as z.ZodType<JobId, string>
const paperIdResult = z.string().uuid().nullable() as unknown as z.ZodType<
  PaperId | null,
  string | null
>

export const operation = defineOperation({
  owner: "job",
  name: "job.setPriority",
  version: 1,
  kind: "command",
  description: "Set a job's priority.",
  input: z.object({ jobId: jobIdSchema, priority: jobPrioritySchema }).strict(),
  publicResult: jobViewSchema
    .extend({
      id: jobIdResult,
      cvDocId: paperIdResult,
      letterDocId: paperIdResult,
    })
    .strip(),
  coach: "confirm",
  delegate: { resource: "job", access: "proposal" },
  destructive: false,
  idempotency: "keyed",
  writes: (input) => [
    { ...jobPriorityResource, entityId: input.jobId },
    { name: "job", entityId: input.jobId, coachFloor: "auto" },
  ],
})
