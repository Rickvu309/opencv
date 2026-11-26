import { z } from "zod"
import { jobPreviewSchema, jobResource } from "../../../apply/job.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "job",
  name: "job.preview",
  version: 1,
  kind: "read",
  description: "Preview a posting without saving it.",
  label: "Preview this Job",
  readLabel: "Previewed this Job",
  input: z
    .object({ url: z.string().optional(), text: z.string().optional() })
    .strict(),
  publicResult: jobPreviewSchema,
  coach: "auto",
  dependsOn: () => [jobResource()],
})
