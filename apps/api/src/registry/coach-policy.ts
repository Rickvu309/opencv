import type { CoachAccess } from "@workspace/domain/kernel"
export type AgentGates = {
  agentCvs: boolean
  agentInterview: boolean
  agentEmail: boolean
}

const CHECKLIST_COMMANDS = new Set([
  "job.addChecklistItem",
  "job.setChecklistItem",
  "job.removeChecklistItem",
])

type CoachRefusal = "never" | "cvs" | "interview" | "email"

export const REFUSAL_MESSAGES: Record<CoachRefusal, string> = {
  never: "The Coach cannot do this",
  cvs: "Turn on Tailored CVs for the Coach in Settings",
  interview: "Turn on Interview prep for the Coach in Settings",
  email: "Turn on Email updates for the Coach in Settings",
}

export function coachRefusal(
  entry: { name: string; coach: CoachAccess | boolean },
  gates: AgentGates
): CoachRefusal | null {
  if (entry.coach === "never" || entry.coach === false) return "never"
  if (entry.name === "paper.edit" && !gates.agentCvs) return "cvs"
  if (CHECKLIST_COMMANDS.has(entry.name) && !gates.agentInterview) {
    return "interview"
  }
  if (entry.name.startsWith("inbox.") && !gates.agentEmail) return "email"
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
