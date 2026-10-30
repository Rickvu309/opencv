import { useEffect, useRef } from "react"
import type { ChatSummary } from "@workspace/domain"

import { ChevronDown } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"

import "@/features/coach/design/coach-history.pen.css"

export function historyGroup(
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
}: CoachHistoryProps) {
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const id = setTimeout(() => searchRef.current?.focus(), 0)
    return () => clearTimeout(id)
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "n") {
        event.preventDefault()
        onNewChat()
        onOpenChange(false)
      }
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open, onNewChat, onOpenChange])

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
            className="min-w-0 shrink gap-1.5 border-0 px-2 text-[13px] leading-[15.5px] max-md:h-11"
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
        className="w-[340px] p-0 ring-0"
      >
        <div
          data-pen-surface="coach"
          data-slot="history-panel"
          className="flex w-[340px] flex-col gap-px rounded-[10px] p-1.5"
        >
          {/* Search row - 34px height */}
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
              className="h-auto flex-1 border-0 bg-transparent p-0 text-[13px] leading-[1.2] shadow-none outline-none ring-0 focus-visible:ring-0"
            />
          </div>

          {/* New chat row - 32px height */}
          <Button
            type="button"
            variant="ghost"
            data-slot="history-new-chat"
            className="flex h-8 w-full items-center gap-2.5 rounded-[6px] px-2.5 text-left text-[13px] leading-[1.2]"
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
              className="text-[11.5px] leading-[1.2]"
            >
              ⌘ N
            </span>
          </Button>

          {/* Chat groups */}
          {GROUPS.map((group) => {
            const items = filtered.filter(
              (chat) => historyGroup(chat.updatedAt) === group
            )
            if (!items.length) return null
            return (
              <section key={group}>
                <div
                  data-slot="history-section-label"
                  className="flex h-7 items-end px-2.5 pb-0 pt-1.5 text-[11.5px] font-medium leading-[1.2]"
                >
                  {group}
                </div>
                {items.map((chat) => (
                  <Button
                    key={chat.id}
                    type="button"
                    variant="ghost"
                    data-slot="history-item"
                    data-active={chat.id === activeChatId ? "true" : undefined}
                    className="flex h-8 w-full items-center gap-2.5 rounded-[6px] px-2.5 text-left text-[13px] leading-[1.2]"
                    onClick={() => {
                      onSelect(chat.id)
                      onOpenChange(false)
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate">{chat.title}</span>
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

          {filtered.length === 0 ? (
            <p className="px-2.5 py-2 text-[13px] text-muted-foreground">
              No chats found.
            </p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}
