import { operation } from "@workspace/domain/operations/inbox/scan"
import type { OperationBinding } from "../../../registry/bind.js"
import { scanInbox } from "../../store.js"

export const implementation = {
  operation,
  execute: (_input, actor) => scanInbox(actor),
  reversal: { irreversible: "Emails read into the Inbox stay there." },
  activity: { silent: "Reading emails leaves no receipt." },
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof scanInbox>>
>
