import { and, eq, gt } from "drizzle-orm"
import type { Auth } from "./auth.js"
import { getDb } from "./db/context.js"
import { verification } from "./db/schema.js"
import { hashAgentToken } from "./connections/index.js"

export async function handleAuthRequest(auth: Auth, request: Request) {
  const path = new URL(request.url).pathname
  const consent = path === "/api/auth/oauth2/consent"
  const authorization =
    path === "/api/auth/oauth2/authorize" ||
    path === "/api/auth/oauth2/continue"
  if (!consent && !authorization) return auth.handler(request)
  const session = await auth.api.getSession({ headers: request.headers })
  if (consent) {
    const body: unknown = await request
      .clone()
      .json()
      .catch(() => null)
    const query =
      body && typeof body === "object" && "oauth_query" in body
        ? body.oauth_query
        : undefined
    if (!session || typeof query !== "string")
      return Response.json({ error: "invalid_request" }, { status: 400 })
    const consumed = await getDb()
      .delete(verification)
      .where(
        and(
          eq(verification.identifier, `agent-consent:${hashAgentToken(query)}`),
          eq(verification.value, session.session.id),
          gt(verification.expiresAt, new Date())
        )
      )
      .returning({ id: verification.id })
    if (consumed.length !== 1)
      return Response.json({ error: "invalid_request" }, { status: 400 })
  }
  const response = await auth.handler(request)
  if (!authorization || !session) return response
  let location = response.headers.get("location")
  if (
    !location &&
    response.headers.get("content-type")?.includes("application/json")
  ) {
    const body: unknown = await response.clone().json()
    if (
      body &&
      typeof body === "object" &&
      "url" in body &&
      typeof body.url === "string"
    )
      location = body.url
  }
  if (!location) return response
  const url = new URL(location, request.url)
  if (url.pathname !== "/oauth/consent") return response
  const query = url.searchParams.get("oauth_query") ?? url.search.slice(1)
  await getDb()
    .insert(verification)
    .values({
      id: hashAgentToken(`${session.session.id}:${query}`),
      identifier: `agent-consent:${hashAgentToken(query)}`,
      value: session.session.id,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    })
    .onConflictDoNothing()
  return response
}
