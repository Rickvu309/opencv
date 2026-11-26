import type { CoachAccess, CoachPermission } from "@workspace/domain/kernel"
export type AgentGates = Record<CoachPermission, boolean>

type CoachRefusal = "never" | CoachPermission

export const REFUSAL_MESSAGES: Record<CoachRefusal, string> = {
  never: "The Coach cannot do this",
  agentCvs: "Turn on Tailored CVs for the Coach in Settings",
  agentInterview: "Turn on Interview prep for the Coach in Settings",
  agentEmail: "Turn on Email updates for the Coach in Settings",
}

export function coachRefusal(
  entry: { coach: CoachAccess | boolean; permission?: CoachPermission },
  gates: AgentGates
): CoachRefusal | null {
  if (entry.coach === "never" || entry.coach === false) return "never"
  if (entry.permission && !gates[entry.permission]) return entry.permission
  return null
}

export const GATES_CLOSED_WITHOUT_CONSENT_TO_READ: AgentGates = {
  agentCvs: false,
  agentInterview: false,
  agentEmail: false,
}

export function omitStoredKeySoTheCommandsOwnWriteStaysReplaySafe(
  command: { idempotency: "keyed" | "none" },
  key: string | undefined
) {
  return command.idempotency === "none" ? undefined : key
}
