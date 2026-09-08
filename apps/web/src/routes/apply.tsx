import { useRouterState } from "@tanstack/react-router"

import { APPLY_OPEN_GUIDE } from "@/features/apply/apply-search.ts"
import { ApplyWorkspace } from "@/features/apply/apply-workspace.tsx"

export function ApplyPage() {
  const openGuide = useRouterState({
    select: (state) =>
      (state.location.search as { open?: string }).open === APPLY_OPEN_GUIDE,
  })

  return <ApplyWorkspace openGuide={openGuide} />
}
