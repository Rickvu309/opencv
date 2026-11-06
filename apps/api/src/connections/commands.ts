import { connectionsContract } from "@workspace/domain"
import { bindCommands, tableQuery } from "../registry/bind.js"
import type { Registry } from "../registry/registry.js"
import { listConnections, revokeConnection } from "./store.js"

export function registerConnections(registry: Registry) {
  bindCommands(registry, connectionsContract, {
    "connections.revoke": {
      handler: (input, actor) => revokeConnection(actor, input.connectionId),
      reversal: () => null,
      activity: () => null,
    },
  })
  registry.addQuery(
    tableQuery("connections.list", {
      description: "Read agent connections",
      coach: false,
      step: () => "Read connections",
      read: (_, actor) => listConnections(actor),
    })
  )
}
