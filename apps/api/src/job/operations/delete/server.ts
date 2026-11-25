import { operation } from "@workspace/domain/operations/job/delete"
import type { OperationBinding } from "../../../registry/bind.js"
import { deleteJob } from "../../board.js"

export const implementation = {
  operation,
  execute: (input, actor) => deleteJob(actor, input.jobId),
  reversal: { irreversible: "A deleted job is gone with its history." },
  activity: { silent: "A deleted job leaves no receipt to point at." },
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof deleteJob>>
>
