import { operation } from "@workspace/domain/operations/connections/revoke"
import type { OperationBinding } from "../../../registry/bind.js"
import { revokeConnection } from "../../store.js"

export const implementation = {
  operation,
  execute: (input, actor) => revokeConnection(actor, input.connectionId),
  reversal: { irreversible: "A revoked connection stays revoked." },
  activity: { silent: "Revoking a connection leaves no receipt." },
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof revokeConnection>>
>
