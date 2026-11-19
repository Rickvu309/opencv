import { useEffect, useRef } from "react"
import { useShortcut } from "@/lib/use-shortcut.ts"
import type { ChatSummary } from "@workspace/domain"

import { ChevronDown } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { Input } from "@workspace/ui/components/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"

import "@/features/coach/design/coach-history.css"

function historyGroup(
  date: string
): "Today" | "Yesterday" | "Last 7 days" | "Earlier" {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const timestamp = new Date(date).getTime()
  if (timestamp >= today.getTime()) return "Today"
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (timestamp >= yesterday.getTime()) return "Yesterday"
  const week = new Date(today)
  week.setDate(week.getDate() - 7)
  return timestamp >= week.getTime() ? "Last 7 days" : "Earlier"
}

function historyTimestamp(date: string, group: string): string {
  const d = new Date(date)
  if (group === "Today") {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  }
  if (group === "Yesterday") {
    return d.toLocaleDateString([], { weekday: "short" })
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" })
}

const GROUPS = ["Today", "Yesterday", "Last 7 days", "Earlier"] as const

interface CoachHistoryProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  headerTitle: string
  chats: ChatSummary[]
  activeChatId: string | null
  search: string
  onSearchChange: (value: string) => void
  onSelect: (chatId: string) => void
  onNewChat: () => void
  triggerClassName?: string
}

export function CoachHistory({
  open,
  onOpenChange,
  headerTitle,
  chats,
  activeChatId,
  search,
  onSearchChange,
  onSelect,
  onNewChat,
  triggerClassName,
}: CoachHistoryProps) {
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const id = setTimeout(() => searchRef.current?.focus(), 0)
    return () => clearTimeout(id)
  }, [open])

  useShortcut({
    key: "n",
    mod: true,
    enabled: open,
    inFields: true,
    onPress: () => {
      onNewChat()
      onOpenChange(false)
    },
  })

  const filtered = chats.filter((chat) =>
    chat.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            data-slot="coach-history-trigger"
            aria-label={`History, ${headerTitle}`}
            className={cn(
              "min-w-0 shrink gap-1.5 border-0 px-2 text-[13px] leading-[15.5px] max-md:h-11",
              triggerClassName
            )}
          />
        }
      >
        <span className="truncate">{headerTitle}</span>
        <ChevronDown className="size-2.75 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        className="w-[min(340px,calc(100dvw-16px))] rounded-[10px] bg-transparent p-0 shadow-none ring-0"
      >
        <div
          data-surface="coach"
          data-slot="history-panel"
          className="flex max-h-[min(30rem,calc(var(--available-height,100dvh)-8px))] w-full flex-col gap-px rounded-[10px] p-1.5"
        >
          <div className="flex h-[34px] items-center gap-2 px-2.5">
            <svg
              data-slot="history-search-icon"
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="shrink-0"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <Input
              ref={searchRef}
              data-slot="history-search"
              aria-label="Search chat history"
              placeholder="Search chats"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Escape" || !search) return
                event.preventDefault()
                event.stopPropagation()
                onSearchChange("")
              }}
              className="h-auto flex-1 border-0 bg-transparent p-0 text-base leading-[1.2] shadow-none ring-0 outline-none focus-visible:ring-0 md:text-[13px]"
            />
          </div>

          <Button
            type="button"
            variant="ghost"
            data-slot="history-new-chat"
            className="flex h-11 w-full items-center gap-2.5 rounded-[6px] px-2.5 text-left text-[13px] leading-[1.2] md:h-8"
            onClick={() => {
              onNewChat()
              onOpenChange(false)
            }}
          >
            <svg
              data-slot="history-item-icon"
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="shrink-0"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span className="flex-1">New chat</span>
            <span
              data-slot="history-shortcut"
              className="text-[11.5px] leading-[1.2] max-md:hidden pointer-coarse:hidden"
            >
              ⌘ N
            </span>
          </Button>

          <div
            data-slot="history-list"
            className="-mx-1.5 flex min-h-0 flex-col gap-px overflow-y-auto overscroll-contain px-1.5"
          >
            {GROUPS.map((group) => {
              const items = filtered.filter(
                (chat) => historyGroup(chat.updatedAt) === group
              )
              if (!items.length) return null
              return (
                <section key={group}>
                  <div
                    data-slot="history-section-label"
                    className="flex h-7 items-end px-2.5 pt-1.5 pb-0 text-[11.5px] leading-[1.2] font-medium"
                  >
                    {group}
                  </div>
                  {items.map((chat) => (
                    <Button
                      key={chat.id}
                      type="button"
                      variant="ghost"
                      data-slot="history-item"
                      data-active={
                        chat.id === activeChatId ? "true" : undefined
                      }
                      className="flex h-11 w-full items-center gap-2.5 rounded-[6px] px-2.5 text-left text-[13px] leading-[1.2] md:h-8"
                      onClick={() => {
                        onSelect(chat.id)
                        onOpenChange(false)
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {chat.title}
                      </span>
                      <span
                        data-slot="history-item-time"
                        className="shrink-0 text-[11.5px] leading-[1.2]"
                      >
                        {historyTimestamp(chat.updatedAt, group)}
                      </span>
                    </Button>
                  ))}
                </section>
              )
            })}

            {chats.length === 0 ? (
              <p
                data-slot="history-empty"
                className="px-2.5 py-2 text-[13px] text-muted-foreground"
              >
                No chats yet. Your Chats with Coach appear here.
              </p>
            ) : filtered.length === 0 ? (
              <div
                role="status"
                data-slot="history-no-match"
                className="flex flex-wrap items-center gap-x-2 px-2.5 py-1 text-[13px] text-muted-foreground"
              >
                <p className="min-w-0 [overflow-wrap:anywhere]">
                  No chats match “{search.trim()}”.
                </p>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-11 px-0 text-[13px] md:h-8"
                  onClick={() => {
                    onSearchChange("")
                    searchRef.current?.focus()
                  }}
                >
                  Clear search
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
