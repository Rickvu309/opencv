import { operation } from "@workspace/domain/operations/inbox/clear-suggestion"
import type { OperationBinding } from "../../../registry/bind.js"
import { clearSuggestion } from "../../store.js"

export const implementation = {
  operation,
  execute: (input, actor) => clearSuggestion(actor, input.threadId),
  reversal: {
    irreversible: "A dismissed suggestion comes back with the next email.",
  },
  activity: { silent: "Dismissing a suggestion leaves no receipt." },
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof clearSuggestion>>
>
