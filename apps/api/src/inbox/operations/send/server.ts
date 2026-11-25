import { operation } from "@workspace/domain/operations/inbox/send"
import type { OperationBinding } from "../../../registry/bind.js"
import { sendReply } from "../../store.js"

export const implementation = {
  operation,
  execute: (input, actor) => sendReply(actor, input.threadId),
  reversal: { irreversible: "A sent reply cannot be unsent." },
  activity: { silent: "The sent reply is its own record in the email." },
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof sendReply>>
>
