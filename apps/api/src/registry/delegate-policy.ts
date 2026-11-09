import {
  ERROR_CODES,
  delegateActorSchema,
  delegateDeclaration,
  delegateToolAllowed,
  proposalGrantAllows,
  type Actor,
  type CoachAccess,
  type DelegateActor,
  type DelegateMarker,
} from "@workspace/domain"
import { and, eq } from "drizzle-orm"
import { getDb } from "../db/context.js"
import { agentConnections } from "../db/schema.js"
import { CommandError } from "./errors.js"

export function delegateAllowed(
  entry: {
    name: string
    coach: CoachAccess | boolean
    delegate?: DelegateMarker
  },
  actor: Actor
) {
  if (actor.type !== "delegate") return true
  return delegateToolAllowed({
    name: entry.name,
    delegate: entry.delegate,
    coach: entry.coach,
    resources: actor.resources,
    reads: actor.reads,
    writes: actor.writes,
    scopes: actor.scopes,
  })
}

export async function requireLiveDelegate(actor: DelegateActor) {
  const [grant] = await getDb()
    .select()
    .from(agentConnections)
    .where(
      and(
        eq(agentConnections.id, actor.connectionId),
        eq(agentConnections.userId, actor.userId)
      )
    )
    .for("update")
  if (
    !grant ||
    grant.revokedAt ||
    grant.expiresAt.getTime() <= Date.now() ||
    grant.resources.kind !== actor.resources ||
    actor.scopes.some((scope) => !grant.scopes.includes(scope)) ||
    grant.policy.reads !== actor.reads ||
    grant.policy.writes !== actor.writes
  )
    throw new CommandError(
      ERROR_CODES.FORBIDDEN,
      "This agent connection is no longer active"
    )
  return grant
}

export async function requireLiveProposalConnection(
  userId: string,
  connectionId: string,
  marker: DelegateMarker | undefined
) {
  const declaration = delegateDeclaration(marker)
  const [grant] = await getDb()
    .select()
    .from(agentConnections)
    .where(
      and(
        eq(agentConnections.id, connectionId),
        eq(agentConnections.userId, userId)
      )
    )
    .for("update")
  if (
    !grant ||
    grant.revokedAt ||
    grant.expiresAt.getTime() <= Date.now() ||
    !declaration ||
    !proposalGrantAllows(
      grant.resources,
      grant.scopes,
      grant.policy.writes,
      declaration
    )
  )
    throw new CommandError(
      ERROR_CODES.FORBIDDEN,
      "This agent connection is no longer active"
    )
  return delegateActorSchema.parse({
    type: "delegate",
    userId: grant.userId,
    connectionId: grant.id,
    name: grant.name,
    scopes: grant.scopes,
    resources: grant.resources.kind,
    ...grant.policy,
  })
}
