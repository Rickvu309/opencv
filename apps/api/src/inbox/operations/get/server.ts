import { operation } from "@workspace/domain/operations/inbox/get"
import type { OperationBinding } from "../../../registry/bind.js"
import { readInboxThread } from "../../store.js"

export const implementation = {
  operation,
  execute: (input, actor) => readInboxThread(actor.userId, input.threadId),
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof readInboxThread>>
>
