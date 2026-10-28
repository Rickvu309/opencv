import { CoachWorkspace } from "@/features/coach/coach-workspace.tsx"

export function ShellChatBody({
  chatId = null,
  primaryAction = false,
}: {
  chatId?: string | null
  primaryAction?: boolean
}) {
  return <CoachWorkspace chatId={chatId} primaryAction={primaryAction} />
}
