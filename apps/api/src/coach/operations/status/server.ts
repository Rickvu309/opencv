import { operation } from "@workspace/domain/operations/coach/status"
import type { OperationBinding } from "../../../registry/bind.js"
import { taskSnapshot } from "../../task-reader.js"

export const implementation = {
  operation,
  execute: (input, actor) => taskSnapshot(input.taskId, actor.userId),
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof taskSnapshot>>
>
