import { operation } from "@workspace/domain/operations/job/unlink-paper"
import type { OperationBinding } from "../../../registry/bind.js"
import { unlinkPaper } from "../../linked-papers.js"

export const implementation = {
  operation,
  execute: (input, actor) => unlinkPaper(actor, input.jobId, input.kind),
  reversal: { irreversible: "Linking the Paper again undoes this." },
  activity: { silent: "Unlinking a Paper leaves no receipt." },
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof unlinkPaper>>
>
