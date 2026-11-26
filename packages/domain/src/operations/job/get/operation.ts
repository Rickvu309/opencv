import { z } from "zod"
import { jobIdSchema } from "../../../ids.js"
import { jobDetailSchema, jobResource } from "../../../apply/job.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "job",
  name: "job.get",
  version: 1,
  kind: "read",
  description: "Read one job.",
  label: "Read this Job",
  readLabel: "Read this Job",
  input: z.object({ jobId: jobIdSchema }).strict(),
  publicResult: jobDetailSchema,
  coach: "auto",
  delegate: "jobRead",
  dependsOn: (input) => [jobResource(input.jobId)],
})
