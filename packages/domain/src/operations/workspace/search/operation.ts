import { z } from "zod"
import { workspaceSearchSchema } from "../../../account.js"
import { everyReadAnUndoOrApprovalCanChange } from "../../../control/control.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "account",
  name: "workspace.search",
  version: 1,
  kind: "read",
  description: "Search chats, documents, and jobs.",
  input: z.object({ query: z.string().trim().min(1).max(200) }).strict(),
  publicResult: workspaceSearchSchema,
  coach: "auto",
  dependsOn: () => [everyReadAnUndoOrApprovalCanChange],
})
