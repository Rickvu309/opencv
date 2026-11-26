import { z } from "zod"
import { activityFeedRowSchema } from "../../../account/account.js"
import { everyReadAnUndoOrApprovalCanChange } from "../../../control/control.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "account",
  name: "activity.list",
  version: 1,
  kind: "read",
  description: "Read the newest activity, optionally for one subject.",
  label: "Look at your activity",
  readLabel: "Looked at your activity",
  input: z
    .object({
      subjectKind: z.string().min(1).optional(),
      subjectId: z.string().min(1).optional(),
    })
    .strict(),
  publicResult: z.array(activityFeedRowSchema),
  coach: "never",
  dependsOn: () => [everyReadAnUndoOrApprovalCanChange],
})
