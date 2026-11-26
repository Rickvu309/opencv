import { parsePaperId } from "@workspace/domain/kernel"
import { operation } from "@workspace/domain/operations/paper/outline"
import type { OperationBinding } from "../../../registry/bind.js"
import { readOutline } from "../../outline.js"

export const implementation = {
  operation,
  execute: (input, actor) =>
    readOutline(actor.userId, parsePaperId(input.docId), input.blockIds),
} satisfies OperationBinding<typeof operation>
