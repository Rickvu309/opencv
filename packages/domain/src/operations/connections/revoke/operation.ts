import { z } from "zod"
import { connectionResource } from "../../../agents/connections.js"
import { connectionIdSchema } from "../../../ids.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "connections",
  name: "connections.revoke",
  version: 1,
  kind: "command",
  description: "Revoke an agent connection immediately.",
  label: "Disconnect your account",
  input: z.object({ connectionId: connectionIdSchema }).strict(),
  publicResult: z.object({ revoked: z.literal(true) }).strict(),
  coach: "never",
  destructive: false,
  idempotency: "keyed",
  writes: () => [connectionResource],
})
