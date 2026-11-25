import { z } from "zod"
import { jobResource, jobResultSchema } from "../../../job.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "job",
  name: "job.calendar",
  version: 1,
  kind: "read",
  description: "List jobs with an interview or deadline in a range.",
  input: z.object({ from: z.string().min(1), to: z.string().min(1) }).strict(),
  publicResult: z.array(jobResultSchema),
  coach: "auto",
  delegate: "jobRead",
  dependsOn: () => [jobResource()],
})
