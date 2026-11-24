import { operation } from "@workspace/domain/operations/profile/update"
import type { OperationBinding } from "../../../../registry/bind.js"
import { updateProfile } from "../../../store.js"

export const implementation = {
  operation,
  execute: (input, actor) => updateProfile(actor, input),
  reversal: { irreversible: "A profile change is changed back by hand." },
  activity: { silent: "A profile change leaves no receipt." },
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof updateProfile>>
>
