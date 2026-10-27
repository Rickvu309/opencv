import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"

import type { InboxThread } from "./inbox-api.ts"
import { InboxRow } from "./inbox-parts.tsx"
import { inboxWhen, unreadCount } from "./inbox-time.ts"

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
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
        <p className="text-sm text-muted-foreground">
          {unreadCount(threads)} unread
        </p>
        <Button variant="ghost" disabled={scanning} onClick={onScan}>
          Scan
        </Button>
      </div>
      <div data-user-content className="min-h-0 flex-1 overflow-y-auto">
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
