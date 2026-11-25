import {
  jobResource,
  jobResultSchema,
  jobUpdateInputSchema,
} from "../../../apply/job.js"
import { defineOperation } from "../../../operation.js"
import { jobPriorityResource, type ResourceRef } from "../../../resources.js"

export const operation = defineOperation({
  owner: "job",
  name: "job.update",
  version: 1,
  kind: "command",
  description:
    "Update job fields. Stage changes go through job.move. Priority changes need the person's approval.",
  input: jobUpdateInputSchema,
  publicResult: jobResultSchema,
  coach: "auto",
  delegate: "reversibleJob",
  destructive: false,
  idempotency: "keyed",
  writes: (input): readonly ResourceRef[] => [
    jobResource(input.jobId),
    ...(input.patch.priority !== undefined
      ? [{ ...jobPriorityResource, entityId: input.jobId }]
      : []),
  ],
})
