import { operation } from "@workspace/domain/operations/workspace/search"
import type { OperationBinding } from "../../../../registry/bind.js"
import { searchWorkspace } from "../../../queries.js"

export const implementation = {
  operation,
  execute: (input, actor) => searchWorkspace(actor, input.query),
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof searchWorkspace>>
>
