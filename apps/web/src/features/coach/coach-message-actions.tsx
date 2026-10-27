import { MessageActions } from "@workspace/ui/components/message-actions"

import type { ChatViewMessage } from "@/features/coach/chat-messages.ts"

const ACTIONS = ["copy", "regenerate"] as const

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
      actions={[...ACTIONS]}
      label="Reply actions"
      regenerateDisabled={!canRegenerate}
      onRegenerate={onRegenerate}
    />
  )
}
