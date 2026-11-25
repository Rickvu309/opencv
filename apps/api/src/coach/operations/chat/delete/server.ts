import { operation } from "@workspace/domain/operations/chat/delete"
import type { OperationBinding } from "../../../../registry/bind.js"
import { deleteChat } from "../../../chat/index.js"

export const implementation = {
  operation,
  execute: (input, actor) => deleteChat(actor, input.chatId),
  reversal: { irreversible: "A deleted chat and its messages are gone." },
  activity: { silent: "Deleting a chat leaves no receipt." },
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof deleteChat>>
>
