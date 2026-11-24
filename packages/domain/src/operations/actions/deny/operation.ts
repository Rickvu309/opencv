import { z } from "zod"
import { pendingActionRowSchema } from "../../../control.js"
import { pendingActionIdSchema } from "../../../ids.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "registry",
  name: "actions.deny",
  version: 1,
  kind: "command",
  description: "Decline a pending Coach action.",
  input: z.object({ pendingActionId: pendingActionIdSchema }).strict(),
  publicResult: pendingActionRowSchema,
  coach: "never",
  destructive: false,
  idempotency: "keyed",
  writes: () => [],
})
