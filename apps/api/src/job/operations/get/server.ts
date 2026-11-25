import { operation } from "@workspace/domain/operations/job/get"
import type { OperationBinding } from "../../../registry/bind.js"
import { getJob } from "../../board.js"

export const implementation = {
  operation,
  execute: (input, actor) => getJob(actor.userId, input.jobId),
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof getJob>>
>
