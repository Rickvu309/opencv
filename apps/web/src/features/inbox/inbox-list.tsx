import type { ReactNode } from "react"
import type { InboxThread } from "@workspace/domain"
import { Clock3, Ellipsis, Inbox as InboxIcon } from "lucide-react"
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
import {
  PageHeader,
  PageHeaderAction,
  PageHeaderActions,
  PageHeaderTitle,
  PageHeaderTitleActions,
} from "@workspace/ui/components/page-header"

import { InboxRow } from "./inbox-parts.tsx"
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
  view,
  onViewChange,
}: {
  scanning: boolean
  onScan: () => void
  view: "inbox" | "snoozed"
  onViewChange: (view: "inbox" | "snoozed") => void
}) {
  return (
    <PageHeader>
      <PageHeaderTitle className="max-md:min-w-0">
        {view === "snoozed" ? "Snoozed" : "Inbox"}
      </PageHeaderTitle>
      <PageHeaderTitleActions>
        <DropdownMenu>
          <PageHeaderAction
            label="More"
            icon={<Ellipsis />}
            render={
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    data-slot="page-header-action"
                  />
                }
              />
            }
          />
          <DropdownMenuContent align="start">
            <DropdownMenuItem disabled={scanning} onClick={onScan}>
              Scan
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </PageHeaderTitleActions>
      <PageHeaderActions>
        <PageHeaderAction
          label={view === "snoozed" ? "Back to inbox" : "Snoozed"}
          icon={<Clock3 />}
          onSelect={() =>
            onViewChange(view === "snoozed" ? "inbox" : "snoozed")
          }
        />
      </PageHeaderActions>
    </PageHeader>
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
  view,
  onViewChange,
}: {
  threads: InboxThread[]
  openId: string | null
  now: Date
  zone?: string
  onOpen: (id: string) => void
  onScan: () => void
  scanning: boolean
  view: "inbox" | "snoozed"
  onViewChange: (view: "inbox" | "snoozed") => void
}) {
  return (
    <section
      aria-label="Messages"
      className="flex min-h-0 min-w-0 flex-1 flex-col"
    >
      <InboxListHeader
        scanning={scanning}
        onScan={onScan}
        view={view}
        onViewChange={onViewChange}
      />
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
        {threads.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {view === "snoozed" ? "No snoozed emails." : "No emails yet."}
          </p>
        ) : null}
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
  view,
  onViewChange,
}: {
  onScan: () => void
  scanning: boolean
  view: "inbox" | "snoozed"
  onViewChange: (view: "inbox" | "snoozed") => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <InboxListHeader
        scanning={scanning}
        onScan={onScan}
        view={view}
        onViewChange={onViewChange}
      />
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
    </div>
  )
}
