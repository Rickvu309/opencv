import { z } from "zod"
import { connectionIdSchema } from "./ids.js"
import {
  connectionResourcesSchema,
  connectionPolicySchema,
} from "./connections.js"
import {
  commandContract,
  commandEntry,
  queryContract,
  queryEntry,
} from "./contract.js"

export const connectionSchema = z
  .object({
    id: connectionIdSchema,
    clientId: z.string(),
    name: z.string(),
    audience: z.string(),
    scopes: z.array(z.string()),
    resources: connectionResourcesSchema,
    policy: connectionPolicySchema,
    version: z.number(),
    consentVersion: z.number(),
    createdAt: z.string().datetime(),
    lastUsedAt: z.string().datetime().nullable(),
    expiresAt: z.string().datetime(),
    revokedAt: z.string().datetime().nullable(),
  })
  .strict()

export const connectionsContract = commandContract({
  "connections.revoke": commandEntry({
    description: "Revoke an agent connection immediately.",
    input: z.object({ connectionId: connectionIdSchema }).strict(),
    output: z.object({ revoked: z.literal(true) }).strict(),
    coach: "never",
    destructive: false,
    step: () => "Revoke the agent connection",
    invalidates: () => [{ query: "connections.list" }],
  }),
})

export const connectionsQueries = queryContract({
  "connections.list": queryEntry({
    input: z.object({}).strict(),
    output: z.array(connectionSchema),
  }),
})
