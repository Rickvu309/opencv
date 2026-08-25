import type { Auth } from "./auth.js"
import type { Context } from "hono"

export async function readSession(auth: Auth, c: Context) {
  return auth.api.getSession({
    headers: c.req.raw.headers,
  })
}
