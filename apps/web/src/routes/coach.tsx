import { useSearch } from "@tanstack/react-router"
import { CoachWorkspace } from "@/features/coach/coach-workspace.tsx"

export function CoachPage() {
  const search = useSearch({ strict: false })
  return (
    <div className="h-full min-h-0 bg-background">
      <CoachWorkspace primaryAction chatId={search.chat} />
    </div>
  )
}
