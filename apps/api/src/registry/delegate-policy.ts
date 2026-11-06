import {
  ERROR_CODES,
  delegateActorSchema,
  type Actor,
  type CoachAccess,
} from "@workspace/domain"
import { and, eq } from "drizzle-orm"
import { getDb } from "../db/context.js"
import { agentConnections } from "../db/schema.js"
import { CommandError } from "./errors.js"

export function delegateAllowed(
  entry: {
    name: string
    coach: CoachAccess | boolean
    delegate?: "reversibleJob" | "jobRead"
  },
  actor: Actor
) {
  if (actor.type !== "delegate") return true
  if (
    actor.resources !== "jobs" ||
    !entry.name.startsWith("job.") ||
    entry.coach === "never" ||
    entry.coach === false
  )
    return false
  return entry.delegate === "jobRead"
    ? actor.reads === "allow" && actor.scopes.includes("job.read")
    : entry.delegate === "reversibleJob" &&
        actor.writes === "approval" &&
        actor.scopes.includes("job.write")
}

export async function requireLiveProposalConnection(
  userId: string,
  connectionId: string
) {
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
    grant.resources.kind !== "jobs" ||
    !grant.scopes.includes("job.write") ||
    grant.policy.writes !== "approval"
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
