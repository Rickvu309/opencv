import type { CoachPart, CoachToolPart } from "./coach-parts.ts"
import { coachReadLabel } from "./coach-tool-labels.ts"

export type CoachReadTrace = { key: string; label: string }

function readTraceLabel(part: CoachPart): string | undefined {
  if (part.kind !== "tool") return undefined
  const { ok, pendingActionId, approval, undone } = part.part
  if (!ok || pendingActionId || approval !== undefined || undone)
    return undefined
  return coachReadLabel(part.name)
}

export function splitReadTraces(parts: readonly CoachPart[]): {
  traces: CoachReadTrace[]
  answer: CoachPart[]
} {
  const traces: CoachReadTrace[] = []
  const answer: CoachPart[] = []
  for (const part of parts) {
    const label = readTraceLabel(part)
    if (label) traces.push({ key: (part as CoachToolPart).key, label })
    else answer.push(part)
  }
  return { traces, answer }
}

export function traceSteps(traces: readonly CoachReadTrace[]) {
  return traces.map((trace) => ({
    id: trace.key,
    label: trace.label,
    status: "completed" as const,
  }))
}
