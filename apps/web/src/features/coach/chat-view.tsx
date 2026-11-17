import type { ReactNode } from "react"
import { cn } from "@workspace/ui/lib/utils"

import { Chat, ChatLog, chatColumn } from "@/components/ai-elements/chat.tsx"
import {
  CoachTurns,
  type CoachTurnsProps,
} from "@/features/coach/coach-turns.tsx"

import { chatStartedLabel, useMountTime } from "./chat-time.ts"

export function ChatView({
  presentation = "page",
  empty = null,
  startedAt = null,
  ...props
}: CoachTurnsProps & {
  presentation?: "page" | "compact"
  empty?: ReactNode
  startedAt?: string | null
}) {
  const page = presentation !== "compact"
  return (
    <Chat>
      <ChatLog
        className={cn(
          chatColumn,
          "[&_[data-slot=message-content]]:text-[15px] [&_[data-slot=message-content]]:leading-[1.5] [&_[data-slot=response]]:max-w-[75ch]",
          page ? "gap-8 pt-6 pb-4 text-base" : undefined
        )}
        viewportClassName="[scrollbar-gutter:auto]!"
      >
        {page && startedAt && props.messages.length > 0 ? (
          <ChatStarted iso={startedAt} />
        ) : null}
        <CoachTurns {...props} />
        {empty}
      </ChatLog>
    </Chat>
  )
}

function ChatStarted({ iso }: { iso: string }) {
  const label = chatStartedLabel(iso, useMountTime())
  if (!label) return null
  return (
    <p
      data-slot="chat-started"
      className="-mb-4 text-center text-[13px] leading-5 text-muted-foreground"
    >
      <time dateTime={iso}>{label}</time>
    </p>
  )
}
