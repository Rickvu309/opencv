import { operation } from "@workspace/domain/operations/coach/events"
import type { OperationBinding } from "../../../registry/bind.js"
import { readTaskEvents } from "../../task-reader.js"

export const implementation = {
  operation,
  execute: (input, actor) =>
    readTaskEvents(input.taskId, actor.userId, input.after),
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof readTaskEvents>>
>
