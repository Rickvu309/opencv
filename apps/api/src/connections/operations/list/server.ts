import { operation } from "@workspace/domain/operations/connections/list"
import type { OperationBinding } from "../../../registry/bind.js"
import { listConnections } from "../../store.js"

export const implementation = {
  operation,
  execute: (_input, actor) => listConnections(actor),
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof listConnections>>
>
