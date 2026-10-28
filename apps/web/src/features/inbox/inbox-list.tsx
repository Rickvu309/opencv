import type { ReactNode } from "react"
import type { InboxThread } from "@workspace/domain"
import {
  Clock3,
  Ellipsis,
  Funnel,
  Inbox as InboxIcon,
  SlidersHorizontal,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"

import { InboxIconButton, InboxRow } from "./inbox-parts.tsx"
import { inboxWhen, unreadCount } from "./inbox-time.ts"

export function InboxListPane({
  narrow,
  children,
}: {
  narrow: boolean
  children: ReactNode
}) {
  return (
    <div
      data-pen-section="List pane"
      className={
        narrow
          ? "flex min-h-0 min-w-0 flex-1 flex-col"
          : "flex min-h-0 w-115 max-w-full shrink-0 flex-col border-r border-border"
      }
    >
      {children}
    </div>
  )
}

export function InboxListHeader({
  scanning,
  onScan,
}: {
  scanning: boolean
  onScan: () => void
}) {
  return (
    <div className="flex h-13 shrink-0 items-center gap-1.5 border-b border-border ps-5 pe-3">
      <h1 className="text-[13px] font-medium text-foreground">Inbox</h1>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <InboxIconButton label="More">
              <Ellipsis />
            </InboxIconButton>
          }
        />
        <DropdownMenuContent align="start">
          <DropdownMenuItem disabled={scanning} onClick={onScan}>
            Scan
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="flex-1" />
      <InboxIconButton label="Snoozed" disabled>
        <Clock3 />
      </InboxIconButton>
      <InboxIconButton label="Filter" disabled>
        <Funnel />
      </InboxIconButton>
      <InboxIconButton label="Display" disabled>
        <SlidersHorizontal />
      </InboxIconButton>
    </div>
  )
}

export function InboxList({
  threads,
  openId,
  now,
  zone,
  onOpen,
  onScan,
  scanning,
}: {
  threads: InboxThread[]
  openId: string | null
  now: Date
  zone?: string
  onOpen: (id: string) => void
  onScan: () => void
  scanning: boolean
}) {
  return (
    <section
      aria-label="Messages"
      className="flex min-h-0 min-w-0 flex-1 flex-col"
    >
      <InboxListHeader scanning={scanning} onScan={onScan} />
      <div
        data-user-content
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2"
      >
        {threads.map((thread) => (
          <InboxRow
            key={thread.id}
            thread={thread}
            time={inboxWhen(thread.lastMessageAt, now, zone)}
            active={thread.id === openId}
            onOpen={() => onOpen(thread.id)}
          />
        ))}
      </div>
    </section>
  )
}

export function InboxOverview({ threads }: { threads: InboxThread[] }) {
  return (
    <section
      aria-label="Overview"
      data-pen-section="Detail pane"
      className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-5.5 pb-10"
    >
      <div className="flex flex-col items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-[14px] border border-border bg-card text-foreground/80 shadow-xs">
          <InboxIcon className="size-5.5" aria-hidden />
        </span>
        <p className="text-sm font-medium text-muted-foreground">
          {unreadCount(threads)} unread
        </p>
      </div>
    </section>
  )
}

export function InboxEmpty({
  onScan,
  scanning,
}: {
  onScan: () => void
  scanning: boolean
}) {
  return (
    <section
      aria-label="Messages"
      className="flex min-h-0 flex-1 items-center justify-center p-6"
    >
      <Empty>
        <EmptyHeader>
          <EmptyTitle data-user-content>No job emails yet</EmptyTitle>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="ghost" disabled={scanning} onClick={onScan}>
            Scan
          </Button>
        </EmptyContent>
      </Empty>
    </section>
  )
}
