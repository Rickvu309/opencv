import { useRouterState } from "@tanstack/react-router"

import { useFirstCafeSurfaceVisit } from "@/features/home/use-first-cafe-surface-visit.ts"
import { PaperWorkspace } from "@/features/paper/paper-workspace.tsx"

export function PaperPage() {
  const openSample = useRouterState({
    select: (state) =>
      (state.location.search as { open?: string }).open === "sample",
  })
  useFirstCafeSurfaceVisit("sample-cv")

  return <PaperWorkspace openSample={openSample} />
}
