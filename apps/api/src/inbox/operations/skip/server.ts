import { operation } from "@workspace/domain/operations/inbox/skip"
import type { OperationBinding } from "../../../registry/bind.js"
import { skipInbox } from "../../store.js"

export const implementation = {
  operation,
  execute: (_input, actor) => skipInbox(actor),
  reversal: { irreversible: "Connecting Gmail turns the Inbox on again." },
  activity: { silent: "Skipping the Inbox leaves no receipt." },
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof skipInbox>>
>
