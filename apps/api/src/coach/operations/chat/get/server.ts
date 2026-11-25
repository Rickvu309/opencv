import { operation } from "@workspace/domain/operations/chat/get"
import type { OperationBinding } from "../../../../registry/bind.js"
import { getChat } from "../../../chat/index.js"

export const implementation = {
  operation,
  execute: (input, actor) => getChat(actor.userId, input.chatId),
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof getChat>>
>
