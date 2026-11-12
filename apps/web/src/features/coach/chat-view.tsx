import { cn } from "@workspace/ui/lib/utils"

import { Chat, ChatLog, chatColumn } from "@/components/ai-elements/chat.tsx"
import {
  CoachTurns,
  type CoachTurnsProps,
} from "@/features/coach/coach-turns.tsx"

export function ChatView({
  presentation = "page",
  ...props
}: CoachTurnsProps & { presentation?: "page" | "compact" }) {
  return (
    <Chat>
      <ChatLog
        className={cn(
          chatColumn,
          presentation === "compact" ? "gap-3.5 py-2" : "gap-5 pt-6"
        )}
        viewportClassName="[scrollbar-gutter:auto]!"
      >
        <CoachTurns {...props} />
      </ChatLog>
    </Chat>
  )
}
