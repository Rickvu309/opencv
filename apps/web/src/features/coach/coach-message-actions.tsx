import type { CoachUsageRating } from "@workspace/domain"
import { MessageActions } from "@workspace/ui/components/message-actions"

import type { HomeMessage } from "@/features/home/threads.ts"

const ACTIONS = ["copy", "regenerate", "feedback"] as const

type Props = {
  message: HomeMessage
  canRegenerate: boolean
  onRate?: (messageId: string, rating: CoachUsageRating) => void
  onRegenerate?: () => void
}

export function CoachMessageActions({
  message,
  canRegenerate,
  onRate,
  onRegenerate,
}: Props) {
  return (
    <MessageActions
      text={message.text}
      actions={[...ACTIONS]}
      label="Reply actions"
      regenerateDisabled={!canRegenerate}
      onRegenerate={onRegenerate}
      feedback={message.rating ?? null}
      feedbackDisabled={message.rating === undefined || !onRate}
      onFeedback={(kind) => {
        if (kind) onRate?.(message.id, kind)
      }}
    />
  )
}
