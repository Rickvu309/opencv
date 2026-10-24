import { Chat, ChatThread } from "@/components/ai-elements/chat.tsx"
import {
  CoachTurns,
  type CoachTurnsProps,
} from "@/features/coach/coach-turns.tsx"

export function ThreadView(props: CoachTurnsProps) {
  return (
    <Chat>
      <ChatThread className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <CoachTurns {...props} />
      </ChatThread>
    </Chat>
  )
}
