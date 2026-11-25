import { operation } from "@workspace/domain/operations/inbox/update-draft"
import type { OperationBinding } from "../../../registry/bind.js"
import { updateDraft } from "../../store.js"

export const implementation = {
  operation,
  execute: (input, actor) => updateDraft(actor, input.threadId, input.body),
  reversal: { irreversible: "An edited draft is edited back by hand." },
  activity: { silent: "A draft is not sent, so it leaves no receipt." },
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof updateDraft>>
>
