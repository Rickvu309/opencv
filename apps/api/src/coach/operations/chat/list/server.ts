import { operation } from "@workspace/domain/operations/chat/list"
import type { OperationBinding } from "../../../../registry/bind.js"
import { listChats } from "../../../chat/index.js"

export const implementation = {
  operation,
  execute: (input, actor) => listChats(actor.userId, input.query),
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof listChats>>
>
