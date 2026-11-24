import { operation } from "@workspace/domain/operations/profile/mark-welcomed"
import type { OperationBinding } from "../../../../registry/bind.js"
import { markWelcomed } from "../../../store.js"

export const implementation = {
  operation,
  execute: (_input, actor) => markWelcomed(actor),
  reversal: { irreversible: "The welcome is finished only once." },
  activity: { silent: "Finishing the welcome leaves no receipt." },
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof markWelcomed>>
>
