import type { CoachProgressRow } from "./coach-progress.ts"
import { CoachWorkFold } from "./coach-work-fold.tsx"

export function CoachWorking({
  rows = [],
  showHeader = true,
}: {
  rows?: readonly CoachProgressRow[]
  showHeader?: boolean
}) {
  return (
    <CoachWorkFold
      steps={rows}
      live
      announce={showHeader}
      writing={!showHeader}
    />
  )
}
