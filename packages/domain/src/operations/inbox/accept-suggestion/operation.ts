import { z } from "zod"
import { inboxThreadResource, threadInput } from "../../../inbox/index.js"
import { defineOperation } from "../../../operation.js"
import type { ResourceRef } from "../../../resources.js"

export const operation = defineOperation({
  owner: "inbox",
  name: "inbox.acceptSuggestion",
  version: 1,
  kind: "command",
  description: "Move the linked job to the suggested stage.",
  label: "Accept this suggestion",
  input: threadInput,
  publicResult: z
    .object({
      id: z.string(),
      jobId: z.string(),
      stage: z.literal("interview"),
      activityId: z.string(),
    })
    .strict(),
  coach: "never",
  destructive: false,
  idempotency: "keyed",
  writes: (input): readonly ResourceRef[] => [
    inboxThreadResource(input.threadId),
    { name: "job", coachFloor: "auto" },
  ],
})
