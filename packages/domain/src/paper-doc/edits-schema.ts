import { z } from "zod"

export const paperEditOutcomeSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("applied"),
      createdIds: z.array(z.string()).optional(),
      merged: z.literal(true).optional(),
    })
    .strict(),
  z.object({ status: z.literal("stale"), reason: z.string() }).strict(),
  z.object({ status: z.literal("invalid"), reason: z.string() }).strict(),
])
