import { z } from "zod"

export const connectionResourcesSchema = z
  .object({ kind: z.enum(["none", "jobs"]) })
  .strict()
export const connectionPolicySchema = z
  .object({ reads: z.literal("allow"), writes: z.literal("approval") })
  .strict()

export const CONNECTION_TOKEN_SECONDS = {
  access: 3600,
  refresh: 2592000,
} as const
