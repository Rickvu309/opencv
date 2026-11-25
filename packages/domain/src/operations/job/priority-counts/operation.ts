import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import { jobPrioritySchema } from "../../../apply/job.js"

export const operation = defineOperation({
  owner: "job",
  name: "job.priorityCounts",
  version: 1,
  kind: "read",
  description: "Count jobs by priority.",
  input: z.object({}).strict(),
  publicResult: z.array(
    z
      .object({
        priority: jobPrioritySchema,
        count: z.number().int().nonnegative(),
      })
      .strict()
  ),
  coach: "auto",
  delegate: { resource: "job", access: "read" },
  dependsOn: () => [{ name: "job", coachFloor: "auto" }],
})
