import "./design/home.css"

import { useId, type ReactNode } from "react"
import type { ChatSummary } from "@workspace/domain"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { chatAge, useMountTime } from "./chat-time.ts"
import { COACH_STARTERS } from "./coach-starters.ts"

export type CoachHomeSize = "page" | "panel"

const RECENT_CHAT_LIMIT = 8

type HomeBelow =
  | { kind: "loading" }
  | { kind: "ideas" }
  | {
      kind: "recent"
      chats: ChatSummary[]
      onOpenChat: (chatId: string) => void
    }

export function CoachHome({
  children,
  onChooseStarter,
  disabled,
  size = "page",
  recentChats = [],
  onOpenChat,
}: {
  children?: ReactNode
  onChooseStarter: (text: string) => void
  disabled: boolean
  size?: CoachHomeSize
  recentChats?: ChatSummary[] | null
  onOpenChat?: (chatId: string) => void
}) {
  const panel = size === "panel"
  const below: HomeBelow =
    panel || !onOpenChat
      ? { kind: "ideas" }
      : recentChats === null
        ? { kind: "loading" }
        : recentChats.length > 0
          ? {
              kind: "recent",
              chats: recentChats.slice(0, RECENT_CHAT_LIMIT),
              onOpenChat,
            }
          : { kind: "ideas" }
  return (
    <div
      data-slot="coach-home"
      data-surface="coach"
      data-size={size}
      className={cn(
        "flex w-full min-w-0 flex-col items-center",
        panel
          ? "my-auto py-6 [@media(max-height:20rem)]:hidden"
          : "min-h-full justify-center px-6 py-16 md:px-4"
      )}
    >
      <h2 className="sr-only">How can I help?</h2>
      {children ? (
        <div data-slot="coach-home-composer" className="w-full max-w-[680px]">
          {children}
        </div>
      ) : null}
      {below.kind === "recent" ? (
        <RecentChats chats={below.chats} onOpenChat={below.onOpenChat} />
      ) : below.kind === "ideas" ? (
        <CoachIdeas
          onChooseStarter={onChooseStarter}
          disabled={disabled}
          spaced={Boolean(children)}
        />
      ) : null}
    </div>
  )
}

function RecentChats({
  chats,
  onOpenChat,
}: {
  chats: ChatSummary[]
  onOpenChat: (chatId: string) => void
}) {
  const now = useMountTime()
  return (
    <ul
      data-slot="coach-recent-chats"
      aria-label="Recent chats"
      className="mt-3 flex w-full max-w-[680px] min-w-0 flex-col"
    >
      {chats.map((chat) => {
        const age = chatAge(chat.updatedAt, now)
        return (
          <li key={chat.id} className="min-w-0">
            <Button
              size="touch"
              variant="ghost"
              data-slot="coach-recent-chat"
              onClick={() => onOpenChat(chat.id)}
              className="w-full min-w-0 justify-start gap-4 rounded-md px-4 text-left text-[14px] leading-5 font-normal text-foreground"
            >
              <span className="min-w-0 flex-1 truncate">{chat.title}</span>
              {age ? (
                <time
                  dateTime={chat.updatedAt}
                  className="shrink-0 text-[13px] text-muted-foreground tabular-nums"
                >
                  <span aria-hidden="true">{age.short}</span>
                  <span className="sr-only">, {age.long}</span>
                </time>
              ) : null}
            </Button>
          </li>
        )
      })}
    </ul>
  )
}

function CoachIdeas({
  onChooseStarter,
  disabled,
  spaced,
}: {
  onChooseStarter: (text: string) => void
  disabled: boolean
  spaced: boolean
}) {
  const describedBy = useId()
  return (
    <ul
      data-slot="coach-ideas"
      aria-label="Ideas for Coach"
      className={cn(
        "flex w-full max-w-[680px] min-w-0 flex-col",
        spaced ? "mt-3" : null
      )}
    >
      {COACH_STARTERS.map(({ title, description, icon: Icon }, index) => (
        <li key={title} className="min-w-0">
          <Button
            size="touch"
            variant="ghost"
            data-slot="coach-starter"
            aria-label={title}
            className="w-full min-w-0 justify-start gap-3 rounded-md px-4 text-left text-[14px] leading-5 font-normal text-foreground [&_svg]:text-muted-foreground"
            aria-describedby={`${describedBy}-${index}`}
            disabled={disabled}
            onClick={() => onChooseStarter(title)}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            <span className="min-w-0 truncate">{title}</span>
            <span id={`${describedBy}-${index}`} className="sr-only">
              {description}
            </span>
          </Button>
        </li>
      ))}
    </ul>
  )
}
