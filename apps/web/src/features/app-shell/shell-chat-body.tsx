import { CoachWorkspace } from "@/features/coach/coach-workspace.tsx"

export function ShellChatBody({ chatId = null }: { chatId?: string | null }) {
  return <CoachWorkspace chatId={chatId} />
}
