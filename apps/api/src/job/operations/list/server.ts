import { operation } from "@workspace/domain/operations/job/list"
import type { OperationBinding } from "../../../registry/bind.js"
import { listJobs } from "../../board.js"

export const implementation = {
  operation,
  execute: (input, actor) => listJobs(actor.userId, input),
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof listJobs>>
>
