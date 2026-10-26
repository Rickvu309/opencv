import { useLocation, useNavigate, useParams } from "@tanstack/react-router"

import { HOME_PATH } from "@/features/app-shell/surfaces.ts"
import { CoachThread } from "@/features/coach/coach-thread.tsx"
import { useThreadStore } from "@/features/home/use-thread-store.ts"

export function CoachPage() {
  const params = useParams({ strict: false })
  const { pathname } = useLocation()
  const { activeThreadId } = useThreadStore()
  const routeChatId = typeof params.chatId === "string" ? params.chatId : null
  const chatId = routeChatId ?? (pathname === HOME_PATH ? activeThreadId : null)
  const navigate = useNavigate()

  return (
    <div className="flex h-full min-h-0 flex-col">
      <CoachThread
        chatId={chatId}
        variant="page"
        onChatId={(id) => {
          void navigate({ href: `/app/coach/${id}` })
        }}
      />
    </div>
  )
}
