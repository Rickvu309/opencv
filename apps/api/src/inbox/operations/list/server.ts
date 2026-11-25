import { operation } from "@workspace/domain/operations/inbox/list"
import type { OperationBinding } from "../../../registry/bind.js"
import { readInbox } from "../../store.js"

export const implementation = {
  operation,
  execute: (_input, actor) => readInbox(actor.userId),
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof readInbox>>
>
