import { z } from "zod"
import {
  activityRowAsTheApiReturnsIt,
  everyReadAnUndoOrApprovalCanChange,
} from "../../../control.js"
import { pendingActionIdSchema } from "../../../ids.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "registry",
  name: "actions.approve",
  version: 1,
  kind: "command",
  description: "Run a pending Coach action.",
  input: z.object({ pendingActionId: pendingActionIdSchema }).strict(),
  publicResult: activityRowAsTheApiReturnsIt.nullable(),
  coach: "never",
  destructive: false,
  idempotency: "keyed",
  writes: () => [everyReadAnUndoOrApprovalCanChange],
})
