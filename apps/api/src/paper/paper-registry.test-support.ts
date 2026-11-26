import type { Operation } from "@workspace/domain"

import { implementations } from "../generated/catalog.js"
import { bindOperation, type OperationBinding } from "../registry/bind.js"
import { Registry } from "../registry/registry.js"
import { registerPaper } from "./commands.js"

export function paperRegistry() {
  const registry = new Registry()
  registerPaper(registry)
  for (const implementation of Object.values(implementations))
    if (implementation.operation.owner === "paper")
      bindOperation(
        registry,
        implementation as unknown as OperationBinding<Operation>
      )
  return registry
}
