import { z } from "zod"
import { idResult, type ConnectionId } from "./ids.js"
import type { ResourceRef } from "./resources.js"

export const connectionResourcesSchema = z
  .object({ kind: z.enum(["none", "jobs", "paper", "jobs-and-paper"]) })
  .strict()
export type ConnectionResources = z.infer<typeof connectionResourcesSchema>
const connectionPolicySchema = z
  .object({ reads: z.literal("allow"), writes: z.literal("approval") })
  .strict()

export const connectionSchema = z
  .object({
    id: idResult<ConnectionId>(),
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

export const connectionResource = {
  name: "connection",
  coachFloor: "never",
} as const satisfies ResourceRef

export const CONNECTION_TOKEN_SECONDS = {
  access: 3600,
  refresh: 2592000,
} as const
