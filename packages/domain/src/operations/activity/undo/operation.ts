import { z } from "zod"
import {
  activityRowAsTheApiReturnsIt,
  everyReadAnUndoOrApprovalCanChange,
} from "../../../control/control.js"
import { activityIdSchema } from "../../../ids.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "registry",
  name: "activity.undo",
  version: 1,
  kind: "command",
  description: "Undo one activity row.",
  label: "Undo this change",
  input: z.object({ activityId: activityIdSchema }).strict(),
  publicResult: activityRowAsTheApiReturnsIt,
  coach: "never",
  destructive: false,
  idempotency: "keyed",
  writes: () => [everyReadAnUndoOrApprovalCanChange],
})
