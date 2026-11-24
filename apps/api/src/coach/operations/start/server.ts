import { operation } from "@workspace/domain/operations/coach/start"
import type { OperationBinding } from "../../../registry/bind.js"
import { startTask } from "../../task-start.js"

export const implementation = {
  operation,
  execute: (input, actor, registry) => startTask(input, actor, registry),
  reversal: { irreversible: "A started Coach task is stopped, not undone." },
  activity: { silent: "The task writes its own receipts as it works." },
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof startTask>>
>
