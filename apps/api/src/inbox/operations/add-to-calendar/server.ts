import { operation } from "@workspace/domain/operations/inbox/add-to-calendar"
import type { OperationBinding } from "../../../registry/bind.js"
import { addToCalendar } from "../../store.js"

export const implementation = {
  operation,
  execute: (input, actor) => addToCalendar(actor, input.threadId, input.start),
  reversal: { irreversible: "A calendar event is removed in the calendar." },
  activity: { silent: "The calendar event is its own record." },
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof addToCalendar>>
>
