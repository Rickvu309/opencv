import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import { jobPrioritySchema } from "../../../apply/job.js"

export const operation = defineOperation({
  owner: "job",
  name: "job.priorityCounts",
  version: 1,
  kind: "read",
  description: "Count jobs by priority.",
  label: "Look at your Job priorities",
  readLabel: "Looked at your Job priorities",
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
