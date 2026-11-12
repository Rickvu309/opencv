import {
  ERROR_CODES,
  delegateActorSchema,
  delegateDeclaration,
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
  const marker = entry.delegate
  const declaration =
    marker === "jobRead"
      ? { resource: "job", access: "read" }
      : marker === "reversibleJob"
        ? { resource: "job", access: "proposal" }
        : marker &&
            typeof marker === "object" &&
            Object.keys(marker).length === 2
          ? marker
          : null
  if (!declaration) return false
  const { resource, access } = declaration
  const shared =
    actor.resources === "jobs-and-paper"
      ? resource === "job" || resource === "paper"
      : actor.resources === (resource === "job" ? "jobs" : resource)
  if (!shared || resource === "none") return false
  return access === "read"
    ? actor.reads === "allow" && actor.scopes.includes(`${resource}.read`)
    : access === "proposal" &&
        entry.coach !== "never" &&
        entry.coach !== false &&
        actor.writes === "approval" &&
        actor.scopes.includes(`${resource}.write`)
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
