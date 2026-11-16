import type { ReactNode } from "react"
import { cn } from "@workspace/ui/lib/utils"

import { Chat, ChatLog, chatColumn } from "@/components/ai-elements/chat.tsx"
import {
  CoachTurns,
  type CoachTurnsProps,
} from "@/features/coach/coach-turns.tsx"

export function ChatView({
  presentation = "page",
  empty = null,
  ...props
}: CoachTurnsProps & {
  presentation?: "page" | "compact"
  empty?: ReactNode
}) {
  return (
    <Chat>
      <ChatLog
        className={cn(
          chatColumn,
          "[&_[data-slot=message-content]]:max-w-[75ch] [&_[data-slot=message-content]]:text-[15px] [&_[data-slot=message-content]]:leading-[1.5]",
          presentation === "compact"
            ? "gap-3.5 py-2"
            : "gap-8 pt-6 pb-4 text-base"
        )}
        viewportClassName="[scrollbar-gutter:auto]!"
      >
        <CoachTurns {...props} />
        {empty}
      </ChatLog>
    </Chat>
  )
}
