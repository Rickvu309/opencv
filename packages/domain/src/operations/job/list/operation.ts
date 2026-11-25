import { z } from "zod"
import {
  jobResource,
  jobResultSchema,
  jobStageSchema,
} from "../../../apply/job.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "job",
  name: "job.list",
  version: 1,
  kind: "read",
  description: "List jobs.",
  input: z
    .object({
      stage: jobStageSchema.optional(),
      company: z.string().optional(),
      location: z.string().optional(),
    })
    .strict(),
  publicResult: z.array(jobResultSchema),
  coach: "auto",
  delegate: "jobRead",
  dependsOn: () => [jobResource()],
})
