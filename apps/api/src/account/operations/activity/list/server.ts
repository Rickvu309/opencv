import { operation } from "@workspace/domain/operations/activity/list"
import type { OperationBinding } from "../../../../registry/bind.js"
import { readActivity } from "../../../queries.js"

export const implementation = {
  operation,
  execute: (input, actor, registry) =>
    readActivity(actor.userId, input, registry),
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof readActivity>>
>
