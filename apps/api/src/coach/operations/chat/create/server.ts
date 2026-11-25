import { operation } from "@workspace/domain/operations/chat/create"
import type { OperationBinding } from "../../../../registry/bind.js"
import { createChat } from "../../../chat/index.js"

export const implementation = {
  operation,
  execute: (input, actor) => createChat(actor, input.title),
  reversal: { irreversible: "A started chat is removed by deleting it." },
  activity: { silent: "Starting a chat changes no saved work." },
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof createChat>>
>
