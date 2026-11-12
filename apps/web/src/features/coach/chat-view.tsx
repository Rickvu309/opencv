import { cn } from "@workspace/ui/lib/utils"

import {
  Chat,
  ChatLog,
  coachThreadColumn,
} from "@/components/ai-elements/chat.tsx"
import {
  CoachTurns,
  type CoachTurnsProps,
} from "@/features/coach/coach-turns.tsx"

export function ChatView(props: CoachTurnsProps) {
  return (
    <Chat>
      <ChatLog
        className={cn(coachThreadColumn, "gap-3.5 py-2")}
        viewportClassName="[scrollbar-gutter:auto]!"
      >
        <CoachTurns {...props} />
      </ChatLog>
    </Chat>
  )
}
