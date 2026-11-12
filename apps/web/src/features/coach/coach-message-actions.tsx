import { MessageActions } from "@/components/ai-elements/actions.tsx"
import type { ChatViewMessage } from "@/features/coach/chat-messages.ts"

type Props = {
  message: ChatViewMessage
  canRegenerate: boolean
  onRegenerate?: () => void
}

export function CoachMessageActions({
  message,
  canRegenerate,
  onRegenerate,
}: Props) {
  return (
    <MessageActions
      text={message.text}
      label="Reply actions"
      canRegenerate={canRegenerate}
      onRegenerate={onRegenerate}
    />
  )
}
