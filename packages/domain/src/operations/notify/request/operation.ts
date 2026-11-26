import { z } from "zod"
import {
  notifyRequestInputSchema,
  notifyTopicSchema,
} from "../../../account/account.js"
import { defineOperation } from "../../../operation.js"
import type { ResourceRef } from "../../../resources.js"

export const operation = defineOperation({
  owner: "account",
  name: "notify.request",
  version: 1,
  kind: "command",
  description: "Ask to hear when a topic is ready.",
  label: "Set a reminder",
  input: notifyRequestInputSchema,
  publicResult: z
    .object({
      id: z.string(),
      topic: notifyTopicSchema,
      createdAt: z.string().datetime(),
    })
    .strict(),
  coach: "auto",
  destructive: false,
  idempotency: "keyed",
  writes: (): readonly ResourceRef[] => [
    { name: "notify", coachFloor: "auto" },
  ],
})
