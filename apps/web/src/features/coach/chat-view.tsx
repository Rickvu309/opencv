import { useRef, type ReactNode } from "react"
import { cn } from "@workspace/ui/lib/utils"

import { Chat, ChatLog, chatColumn } from "@/components/ai-elements/chat.tsx"
import {
  CoachTurns,
  type CoachTurnsProps,
} from "@/features/coach/coach-turns.tsx"

import { liveSendKey } from "./chat-messages.ts"
import { chatStartedLabel, useMountTime } from "./chat-time.ts"
import { useSendGlide } from "./use-send-glide.ts"

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
  const content = useRef<HTMLDivElement>(null)
  useSendGlide(content, liveSendKey(props.messages, props.pendingUser))
  return (
    <Chat>
      <ChatLog
        ref={content}
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
      className="-mb-4 text-center text-ui leading-5 text-muted-foreground"
    >
      <time dateTime={iso}>{label}</time>
    </p>
  )
}
