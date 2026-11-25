import { operation } from "@workspace/domain/operations/job/preview"
import type { OperationBinding } from "../../../registry/bind.js"
import { previewPosting } from "../../commands.js"

export const implementation = {
  operation,
  execute: (input, actor, registry) => previewPosting(actor, input, registry),
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof previewPosting>>
>
