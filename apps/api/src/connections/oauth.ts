import { createHash, randomUUID } from "node:crypto"
import { and, eq, gt, isNull } from "drizzle-orm"
import { APIError } from "better-auth/api"
import { z } from "zod"
import { getDb, transaction } from "../db/context.js"
import {
  agentConnections,
  oauthAccessToken,
  oauthClient,
  oauthRefreshToken,
} from "../db/schema.js"

export function hashAgentToken(token: string) {
  return createHash("sha256").update(token).digest("base64url")
}

export async function bindIssuedToken(value: unknown, audience: string) {
  const response = z.object({ access_token: z.string() }).safeParse(value)
  if (!response.success) return
  await transaction(async () => {
    const db = getDb()
    const [token] = await db
      .select()
      .from(oauthAccessToken)
      .where(
        eq(oauthAccessToken.token, hashAgentToken(response.data.access_token))
      )
    if (
      !token?.userId ||
      token.confirmation != null ||
      !token.authorizationCodeId ||
      !token.resources?.includes(audience)
    )
      throw new APIError("FORBIDDEN")
    const [client] = await db
      .select()
      .from(oauthClient)
      .where(eq(oauthClient.clientId, token.clientId))
    const [refresh] = token.refreshId
      ? await db
          .select()
          .from(oauthRefreshToken)
          .where(eq(oauthRefreshToken.id, token.refreshId))
      : []
    await db
      .insert(agentConnections)
      .values({
        id: randomUUID(),
        userId: token.userId,
        clientId: token.clientId,
        authorizationCodeId: token.authorizationCodeId,
        name: client?.name ?? "Connected agent",
        audience,
        scopes: token.scopes,
        resources: {
          kind:
            token.scopes.includes("job.read") ||
            token.scopes.includes("job.write")
              ? "jobs"
              : "none",
        },
        policy: { reads: "allow", writes: "approval" },
        expiresAt: refresh?.expiresAt ?? token.expiresAt,
      })
      .onConflictDoNothing({ target: agentConnections.authorizationCodeId })
    const [connection] = await db
      .select()
      .from(agentConnections)
      .where(
        eq(agentConnections.authorizationCodeId, token.authorizationCodeId)
      )
      .for("update")
    if (
      !connection ||
      connection.revokedAt ||
      connection.expiresAt <= new Date()
    )
      throw new APIError("BAD_REQUEST", { error: "invalid_grant" })
  })
}

export async function assertRefreshGrant(value: unknown) {
  if (typeof value !== "string")
    throw new APIError("BAD_REQUEST", { error: "invalid_grant" })
  const db = getDb()
  const [row] = await db
    .select()
    .from(oauthRefreshToken)
    .innerJoin(
      agentConnections,
      eq(
        oauthRefreshToken.authorizationCodeId,
        agentConnections.authorizationCodeId
      )
    )
    .where(
      and(
        eq(oauthRefreshToken.token, hashAgentToken(value)),
        isNull(agentConnections.revokedAt),
        gt(agentConnections.expiresAt, new Date())
      )
    )
  if (!row) throw new APIError("BAD_REQUEST", { error: "invalid_grant" })
}

export async function authenticateAgent(
  value: string | undefined,
  audience: string
) {
  if (!value?.startsWith("Bearer ")) return null
  return transaction(async () => {
    const db = getDb()
    const [row] = await db
      .select()
      .from(oauthAccessToken)
      .innerJoin(
        agentConnections,
        and(
          eq(
            oauthAccessToken.authorizationCodeId,
            agentConnections.authorizationCodeId
          ),
          eq(oauthAccessToken.userId, agentConnections.userId),
          eq(oauthAccessToken.clientId, agentConnections.clientId)
        )
      )
      .innerJoin(
        oauthClient,
        eq(oauthAccessToken.clientId, oauthClient.clientId)
      )
      .where(
        and(
          eq(oauthAccessToken.token, hashAgentToken(value.slice(7))),
          isNull(oauthAccessToken.revoked),
          gt(oauthAccessToken.expiresAt, new Date()),
          isNull(agentConnections.revokedAt),
          gt(agentConnections.expiresAt, new Date()),
          eq(agentConnections.audience, audience)
        )
      )

    if (
      !row ||
      row.oauth_access_token.confirmation != null ||
      !row.agent_connections.scopes.includes("connection.status") ||
      row.oauth_client.disabled ||
      !row.oauth_access_token.resources?.includes(audience) ||
      !row.oauth_access_token.scopes.includes("connection.status")
    )
      return null
    if (
      row.oauth_access_token.scopes.some(
        (scope) => !row.agent_connections.scopes.includes(scope)
      )
    )
      return null
    const [live] = await db
      .select()
      .from(agentConnections)
      .where(
        and(
          eq(agentConnections.id, row.agent_connections.id),
          isNull(agentConnections.revokedAt),
          gt(agentConnections.expiresAt, new Date())
        )
      )
      .for("update")
    if (
      !live ||
      row.oauth_access_token.scopes.some(
        (scope) => !live.scopes.includes(scope)
      )
    )
      return null
    await db
      .update(agentConnections)
      .set({ lastUsedAt: new Date() })
      .where(eq(agentConnections.id, row.agent_connections.id))
    return { ...live, scopes: row.oauth_access_token.scopes }
  })
}
