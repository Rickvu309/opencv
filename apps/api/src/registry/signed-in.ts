import type { Context } from "hono"

export type SignedInGate = (
  c: Context,
  run: (userId: string) => Promise<Response>
) => Promise<Response>
