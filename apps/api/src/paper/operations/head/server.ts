import { parsePaperId } from "@workspace/domain/kernel"
import { operation } from "@workspace/domain/operations/paper/head"
import type { OperationBinding } from "../../../registry/bind.js"
import { headOf } from "../../engine-sync-log.js"

export const implementation = {
  operation,
  execute: ({ docId }, actor) => headOf(actor.userId, parsePaperId(docId)),
} satisfies OperationBinding<typeof operation>
