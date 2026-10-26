import { useNavigate, useParams } from "@tanstack/react-router"

import { CoachThread } from "@/features/coach/coach-thread.tsx"

export function CoachPage() {
  const params = useParams({ strict: false })
  const chatId = typeof params.chatId === "string" ? params.chatId : null
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
