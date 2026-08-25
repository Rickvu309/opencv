import {
  Copy,
  Link2,
  MoreHorizontal,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react"

import type { HomeMessage } from "@/features/home/threads.ts"

const MESSAGE_ACTIONS = [
  { label: "Copy", icon: Copy },
  { label: "Copy link", icon: Link2 },
  { label: "Good response", icon: ThumbsUp },
  { label: "Bad response", icon: ThumbsDown },
  { label: "Regenerate", icon: RefreshCw },
  { label: "More", icon: MoreHorizontal },
] as const

function MessageActions() {
  return (
    <div className="flex items-center gap-0.5">
      {MESSAGE_ACTIONS.map((action) => {
        const Icon = action.icon
        return (
          <button
            key={action.label}
            type="button"
            disabled
            aria-label={action.label}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-40"
          >
            <Icon className="size-3.5" />
          </button>
        )
      })}
    </div>
  )
}

type Props = {
  messages: HomeMessage[]
  thinking?: boolean
}

export function ThreadView({ messages, thinking }: Props) {
  return (
    <div
      role="log"
      aria-label="Thread"
      aria-live="polite"
      className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6 sm:px-6 sm:py-8"
    >
      {messages.map((item) =>
        item.role === "user" ? (
          <div key={item.id} className="flex justify-end">
            <div className="max-w-[min(85%,28rem)] rounded-2xl bg-muted px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
              {item.text}
            </div>
          </div>
        ) : (
          <div key={item.id} className="space-y-2">
            {item.workedMs ? (
              <p className="text-xs text-muted-foreground">
                Worked for {Math.max(1, Math.round(item.workedMs / 1000))}s
              </p>
            ) : null}
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {item.text}
            </p>
            <MessageActions />
          </div>
        )
      )}

      {thinking ? (
        <div role="status" aria-label="Coach is working" className="space-y-2">
          <p className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
            Working
            <span className="inline-flex gap-0.5" aria-hidden>
              <span className="animate-pulse">.</span>
              <span className="animate-pulse [animation-delay:150ms]">.</span>
              <span className="animate-pulse [animation-delay:300ms]">.</span>
            </span>
          </p>
        </div>
      ) : null}
    </div>
  )
}
