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
          presentation === "compact"
            ? "gap-3.5 py-2 text-[14px] leading-[22px]"
            : "gap-8 pt-6 pb-4 text-base leading-[26px]"
        )}
        viewportClassName="[scrollbar-gutter:auto]!"
      >
        <CoachTurns {...props} />
        {empty}
      </ChatLog>
    </Chat>
  )
}
