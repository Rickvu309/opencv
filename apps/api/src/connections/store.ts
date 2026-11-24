import { and, desc, eq, isNull, sql } from "drizzle-orm"
import {
  ERROR_CODES,
  connectionIdSchema,
  type Actor,
  type ConnectionId,
} from "@workspace/domain"
import { getDb } from "../db/context.js"
import {
  agentConnections,
  oauthAccessToken,
  oauthConsent,
  oauthRefreshToken,
} from "../db/schema.js"
import { CommandError } from "../platform/errors.js"

export async function listConnections(actor: Actor) {
  if (actor.type !== "person")
    throw new CommandError(
      ERROR_CODES.FORBIDDEN,
      "Only you can manage connections"
    )
  const rows = await getDb()
    .select({
      id: agentConnections.id,
      clientId: agentConnections.clientId,
      name: agentConnections.name,
      audience: agentConnections.audience,
      scopes: agentConnections.scopes,
      resources: agentConnections.resources,
      policy: agentConnections.policy,
      version: agentConnections.version,
      consentVersion: agentConnections.consentVersion,
      createdAt: agentConnections.createdAt,
      lastUsedAt: agentConnections.lastUsedAt,
      expiresAt: agentConnections.expiresAt,
      revokedAt: agentConnections.revokedAt,
    })
    .from(agentConnections)
    .where(eq(agentConnections.userId, actor.userId))
    .orderBy(desc(agentConnections.createdAt))
  return rows.map((row) => ({
    ...row,
    id: connectionIdSchema.parse(row.id),
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
  }))
}

export async function revokeConnection(
  actor: Actor,
  connectionId: ConnectionId
) {
  if (actor.type !== "person")
    throw new CommandError(
      ERROR_CODES.FORBIDDEN,
      "Only you can revoke connections"
    )
  const db = getDb()
  const [row] = await db
    .select()
    .from(agentConnections)
    .where(
      and(
        eq(agentConnections.id, connectionId),
        eq(agentConnections.userId, actor.userId)
      )
    )
    .for("update")
  if (!row)
    throw new CommandError(ERROR_CODES.NOT_FOUND, "Connection not found")
  const now = new Date()
  await db
    .update(agentConnections)
    .set({ revokedAt: now, version: sql`${agentConnections.version} + 1` })
    .where(
      and(
        eq(agentConnections.id, connectionId),
        isNull(agentConnections.revokedAt)
      )
    )
  await db
    .update(oauthAccessToken)
    .set({ revoked: now })
    .where(eq(oauthAccessToken.authorizationCodeId, row.authorizationCodeId))
  await db
    .update(oauthRefreshToken)
    .set({ revoked: now })
    .where(eq(oauthRefreshToken.authorizationCodeId, row.authorizationCodeId))
  await db
    .delete(oauthConsent)
    .where(
      and(
        eq(oauthConsent.clientId, row.clientId),
        eq(oauthConsent.userId, actor.userId)
      )
    )
  return { revoked: true as const }
}
