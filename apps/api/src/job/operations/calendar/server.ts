import { operation } from "@workspace/domain/operations/job/calendar"
import type { OperationBinding } from "../../../registry/bind.js"
import { calendarJobs } from "../../board.js"

export const implementation = {
  operation,
  execute: (input, actor) => calendarJobs(actor.userId, input.from, input.to),
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof calendarJobs>>
>
