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
  PageHeaderAction,
  PageHeaderActions,
  PageHeaderTitle,
  PageHeaderTitleActions,
} from "@workspace/ui/components/page-header"

import { cn } from "@workspace/ui/lib/utils"

import { WorkspaceHeader } from "@/components/workspace-header.tsx"
import { InboxRow, VIEW_EXAMPLE_LABEL } from "./inbox-parts.tsx"
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
  scanLabel = "Scan",
  view,
  onViewChange,
}: {
  scanning: boolean
  onScan: () => void
  scanLabel?: string
  view: "inbox" | "snoozed"
  onViewChange: (view: "inbox" | "snoozed") => void
}) {
  return (
    <WorkspaceHeader>
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
                    className="h-11 md:h-8"
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
              {scanLabel}
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
    </WorkspaceHeader>
  )
}

export function InboxList({
  threads,
  openId,
  now,
  zone,
  onOpen,
  onScan,
  scanLabel = "Scan",
  notice,
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
  scanLabel?: string
  notice?: string
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
        scanLabel={scanLabel}
        view={view}
        onViewChange={onViewChange}
      />
      {notice ? <InboxExampleBanner text={notice} /> : null}
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
        <p className="text-sm font-medium text-muted-foreground tabular-nums">
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
  note,
}: {
  onScan: () => void
  scanning: boolean
  view: "inbox" | "snoozed"
  onViewChange: (view: "inbox" | "snoozed") => void
  note?: string
}) {
  const example = Boolean(note)
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <InboxListHeader
        scanning={scanning}
        onScan={onScan}
        scanLabel={example ? VIEW_EXAMPLE_LABEL : "Scan"}
        view={view}
        onViewChange={onViewChange}
      />
      <section
        aria-label="Messages"
        className="flex min-h-0 min-w-0 flex-1 items-center justify-center p-6"
      >
        <Empty>
          <EmptyHeader>
            <EmptyTitle data-user-content>No job emails yet</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            {note ? (
              <p className="max-w-sm text-center text-sm leading-normal text-pretty text-foreground">
                {note}
              </p>
            ) : null}
            <Button
              className="h-11 max-w-full md:h-8"
              variant={example ? "outline" : "ghost"}
              disabled={scanning}
              onClick={onScan}
            >
              {example ? VIEW_EXAMPLE_LABEL : "Scan"}
            </Button>
          </EmptyContent>
        </Empty>
      </section>
    </div>
  )
}

export function InboxExampleBanner({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  return (
    <p
      role="status"
      data-slot="inbox-example-banner"
      className={cn(
        "mx-3 mt-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-[13px] leading-normal text-pretty text-foreground",
        className
      )}
    >
      {text}
    </p>
  )
}
