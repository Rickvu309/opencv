import { z } from "zod"
import { idResult, type JobId } from "../../../ids.js"
import { jobAddNoteInputSchema, jobResource } from "../../../apply/job.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "job",
  name: "job.addNote",
  version: 1,
  kind: "command",
  description: "Add a note. The activity row is the note.",
  input: jobAddNoteInputSchema,
  publicResult: z
    .object({ jobId: idResult<JobId>(), body: z.string() })
    .strip(),
  coach: "auto",
  destructive: false,
  idempotency: "keyed",
  writes: (input) => [jobResource(input.jobId)],
})
