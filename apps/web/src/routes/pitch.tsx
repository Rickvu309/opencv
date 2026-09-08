import { useFirstCafeSurfaceVisit } from "@/features/home/use-first-cafe-surface-visit.ts"
import { PitchWorkspace } from "@/features/pitch/pitch-workspace.tsx"

export function PitchPage() {
  useFirstCafeSurfaceVisit("pitch")
  return <PitchWorkspace />
}
