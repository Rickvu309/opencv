import { operation } from "@workspace/domain/operations/chat/append-message"
import type { OperationBinding } from "../../../../registry/bind.js"
import { appendChatMessage } from "../../../chat/index.js"

export const implementation = {
  operation,
  execute: (input, actor) => appendChatMessage(actor, input),
  reversal: { irreversible: "A sent message stays in the chat." },
  activity: { silent: "A message is its own record." },
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof appendChatMessage>>
>
