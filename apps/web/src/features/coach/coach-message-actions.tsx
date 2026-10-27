import { MessageActions } from "@workspace/ui/components/message-actions"

import type { HomeMessage } from "@/features/home/threads.ts"

const ACTIONS = ["copy", "regenerate"] as const

type Props = {
  message: HomeMessage
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
