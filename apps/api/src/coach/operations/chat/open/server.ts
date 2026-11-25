import { operation } from "@workspace/domain/operations/chat/open"
import type { OperationBinding } from "../../../../registry/bind.js"
import { openChat } from "../../../chat/index.js"

export const implementation = {
  operation,
  execute: (input, actor) => openChat(actor, input),
  reversal: { irreversible: "An opened chat is removed by deleting it." },
  activity: { silent: "Opening a chat changes no saved work." },
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof openChat>>
>
