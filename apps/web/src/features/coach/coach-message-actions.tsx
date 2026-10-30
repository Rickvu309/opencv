import { MessageActions } from "@workspace/ui/components/message-actions"

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
      actions={onRegenerate ? ["copy", "regenerate"] : ["copy"]}
      label="Reply actions"
      regenerateDisabled={!canRegenerate}
      onRegenerate={onRegenerate}
    />
  )
}
