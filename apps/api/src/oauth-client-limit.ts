import { sql, type SQL } from "drizzle-orm"
import type { MiddlewareHandler } from "hono"
import type { AppDatabase } from "./db/context.js"
import {
  agentConnections,
  oauthAccessToken,
  oauthClient,
  oauthConsent,
  oauthRefreshToken,
} from "./db/schema.js"

export type OAuthClientLimits = {
  pendingClients: number
  pendingHours: number
  registrationBytes: number
  nameChars: number
  redirectUris: number
  uriChars: number
}

export const OAUTH_CLIENT_LIMITS: OAuthClientLimits = {
  pendingClients: 5000,
  pendingHours: 24,
  registrationBytes: 16_384,
  nameChars: 100,
  redirectUris: 10,
  uriChars: 2048,
}

export const CLIENT_REGISTRATION_PATH = "/api/auth/oauth2/register"

export const CLIENT_CREATING_AUTH_PATHS: ReadonlySet<string> = new Set([
  CLIENT_REGISTRATION_PATH,
  "/api/auth/oauth2/authorize",
  "/api/auth/oauth2/public-client-prelogin",
])

export const UNKNOWN_CLIENT_DESCRIPTION = `client not found: this client registration expired or never existed, so register the client again with POST ${CLIENT_REGISTRATION_PATH}`

const HIDDEN_OR_REORDERING_CHARACTERS = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u

function pendingClientIn(alias: string) {
  const client = sql.raw(alias)
  return sql`${client}.user_id is null
    and ${client}.reference_id is null
    and ${client}.skip_consent is not true
    and not exists (select 1 from ${oauthConsent} consent where consent.client_id = ${client}.client_id)
    and not exists (select 1 from ${oauthAccessToken} access where access.client_id = ${client}.client_id)
    and not exists (select 1 from ${oauthRefreshToken} refresh where refresh.client_id = ${client}.client_id)
    and not exists (select 1 from ${agentConnections} connection where connection.client_id = ${client}.client_id)`
}

async function deletedCount(db: AppDatabase, chosen: SQL) {
  const result = await db.execute(
    sql`delete from ${oauthClient} where id in (${chosen}) returning id`
  )
  return result.rows.length
}

export async function sweepPendingClients(
  db: AppDatabase,
  now: Date,
  limits: OAuthClientLimits = OAUTH_CLIENT_LIMITS
) {
  const cutoff = new Date(
    now.getTime() - limits.pendingHours * 3_600_000
  ).toISOString()
  const expired = await deletedCount(
    db,
    sql`select pending.id from ${oauthClient} pending
      where ${pendingClientIn("pending")}
      and (pending.created_at is null or pending.created_at < ${cutoff}::timestamptz)`
  )
  const overflow = await deletedCount(
    db,
    sql`select pending.id from ${oauthClient} pending
      where ${pendingClientIn("pending")}
      order by pending.created_at desc nulls last, pending.id
      offset ${limits.pendingClients}`
  )
  if (overflow > 0)
    console.warn(
      `[auth] removed ${overflow} never-approved agent clients past the bound of ${limits.pendingClients}`
    )
  return { expired, overflow }
}

export function registrationProblem(
  text: string,
  limits: OAuthClientLimits = OAUTH_CLIENT_LIMITS
): string | null {
  if (new TextEncoder().encode(text).length > limits.registrationBytes)
    return `registration metadata is larger than ${limits.registrationBytes} bytes`
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return null
  }
  if (!body || typeof body !== "object") return null
  const { client_name: name, redirect_uris: redirects } = body as Record<
    string,
    unknown
  >
  if (typeof name === "string") {
    if ([...name].length > limits.nameChars)
      return `client_name is longer than ${limits.nameChars} characters`
    if (HIDDEN_OR_REORDERING_CHARACTERS.test(name))
      return "client_name must be plain text without control, format or direction characters"
  }
  if (Array.isArray(redirects)) {
    if (redirects.length > limits.redirectUris)
      return `redirect_uris has more than ${limits.redirectUris} entries`
    if (
      redirects.some(
        (uri) => typeof uri === "string" && uri.length > limits.uriChars
      )
    )
      return `each redirect URI must be at most ${limits.uriChars} characters`
  }
  return null
}

function unknownClientLocation(location: string) {
  const url = new URL(location, "http://placeholder.invalid")
  if (
    url.searchParams.get("error") !== "invalid_client" ||
    url.searchParams.get("error_description") !== "client not found"
  )
    return null
  url.searchParams.set("error_description", UNKNOWN_CLIENT_DESCRIPTION)
  return url.origin === "http://placeholder.invalid"
    ? `${url.pathname}${url.search}${url.hash}`
    : url.href
}

export async function explainUnknownClient(response: Response) {
  const location = response.headers.get("location")
  if (location) {
    const explained = unknownClientLocation(location)
    if (!explained) return response
    const headers = new Headers(response.headers)
    headers.set("location", explained)
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }
  if (
    response.status < 400 ||
    !response.headers.get("content-type")?.includes("application/json")
  )
    return response
  const body: unknown = await response
    .clone()
    .json()
    .catch(() => null)
  if (
    !body ||
    typeof body !== "object" ||
    !("error_description" in body) ||
    body.error_description !== "client not found"
  )
    return response
  const headers = new Headers(response.headers)
  headers.delete("content-length")
  return new Response(
    JSON.stringify({ ...body, error_description: UNKNOWN_CLIENT_DESCRIPTION }),
    { status: response.status, statusText: response.statusText, headers }
  )
}

export function oauthClientLimit({
  db,
  now = () => new Date(),
  limits = OAUTH_CLIENT_LIMITS,
}: {
  db: AppDatabase
  now?: () => Date
  limits?: OAuthClientLimits
}): MiddlewareHandler {
  return async (c, next) => {
    const path = c.req.path
    if (path === CLIENT_REGISTRATION_PATH && c.req.method === "POST") {
      const problem = registrationProblem(
        await c.req.raw.clone().text(),
        limits
      )
      if (problem)
        return c.json(
          { error: "invalid_client_metadata", error_description: problem },
          400
        )
    }
    await next()
    if (CLIENT_CREATING_AUTH_PATHS.has(path) && c.res.status < 400)
      await sweepPendingClients(db, now(), limits).catch((error: unknown) =>
        console.error("[auth] agent client sweep failed", error)
      )
    const explained = await explainUnknownClient(c.res)
    if (explained === c.res) return
    c.res = undefined
    c.res = explained
  }
}
