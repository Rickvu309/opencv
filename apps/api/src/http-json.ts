import type { Context } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"

export function jsonWithStatus<T>(c: Context, body: T, status: number) {
  return c.json(body, status as ContentfulStatusCode)
}
