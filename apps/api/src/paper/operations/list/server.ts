import { operation } from "@workspace/domain/operations/paper/list"
import type { OperationBinding } from "../../../registry/bind.js"
import { listPapers } from "../../store.js"

export const implementation = {
  operation,
  execute: (input, actor) => listPapers(actor.userId, input.query, input.kind),
} satisfies OperationBinding<typeof operation>
