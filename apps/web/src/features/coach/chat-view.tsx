import { Chat, ChatLog } from "@/components/ai-elements/chat.tsx"
import {
  CoachTurns,
  type CoachTurnsProps,
} from "@/features/coach/coach-turns.tsx"

export function ChatView(props: CoachTurnsProps) {
  return (
    <Chat>
      <ChatLog className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <CoachTurns {...props} />
      </ChatLog>
    </Chat>
  )
}
