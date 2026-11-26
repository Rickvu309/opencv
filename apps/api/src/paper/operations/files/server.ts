import { operation } from "@workspace/domain/operations/paper/files"
import type { OperationBinding } from "../../../registry/bind.js"
import { listFiles } from "../../store.js"

export const implementation = {
  operation,
  execute: (_input, actor) => listFiles(actor.userId),
} satisfies OperationBinding<typeof operation>
