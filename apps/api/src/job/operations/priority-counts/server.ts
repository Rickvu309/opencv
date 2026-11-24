import { operation } from "@workspace/domain/operations/job/priority-counts"
import type { OperationBinding } from "../../../registry/bind.js"
import { priorityCounts } from "../../store.js"

export const implementation = {
  operation,
  execute: (_input, actor) => priorityCounts(actor.userId),
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof priorityCounts>>
>
