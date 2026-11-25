import { operation } from "@workspace/domain/operations/inbox/snoozed"
import type { OperationBinding } from "../../../registry/bind.js"
import { readSnoozedInbox } from "../../store.js"

export const implementation = {
  operation,
  execute: (_input, actor) => readSnoozedInbox(actor.userId),
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof readSnoozedInbox>>
>
