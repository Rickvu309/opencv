import { useRouterState } from "@tanstack/react-router"

import { PaperWorkspace } from "@/features/paper/paper-workspace.tsx"

export function PaperPage() {
  const openSample = useRouterState({
    select: (state) =>
      (state.location.search as { open?: string }).open === "sample",
  })

  return <PaperWorkspace openSample={openSample} />
}
