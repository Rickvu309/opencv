import { operation } from "@workspace/domain/operations/profile/get"
import type { OperationBinding } from "../../../../registry/bind.js"
import { readProfile } from "../../../queries.js"

export const implementation = {
  operation,
  execute: (_input, actor) => readProfile(actor),
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof readProfile>>
>
