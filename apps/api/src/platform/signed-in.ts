import type { MiddlewareHandler } from "hono"

export type SignedInVariables = { userId: string }

export type SignedIn = MiddlewareHandler<{ Variables: SignedInVariables }>
