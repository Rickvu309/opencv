import { operation } from "@workspace/domain/operations/integrations/list"
import type { OperationBinding } from "../../../../registry/bind.js"
import { listIntegrations } from "../../../queries.js"

export const implementation = {
  operation,
  execute: (_input, actor) => listIntegrations(actor.userId),
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof listIntegrations>>
>
