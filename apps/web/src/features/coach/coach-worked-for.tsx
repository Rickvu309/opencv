import { traceSteps, type CoachReadTrace } from "./coach-read-trace.ts"
import { CoachWorkFold } from "./coach-work-fold.tsx"

export function CoachWorkedFor({
  workedMs,
  traces,
}: {
  workedMs: number
  traces: readonly CoachReadTrace[]
}) {
  return (
    <CoachWorkFold
      steps={traceSteps(traces)}
      live={false}
      workedMs={workedMs}
    />
  )
}
