import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"

import { companyInitials } from "@/features/apply/apply-stages.ts"

import type { InboxThread } from "./inbox-api.ts"

export function InboxRow({
  thread,
  time,
  active,
  onOpen,
}: {
  thread: InboxThread
  time: string
  active: boolean
  onOpen: () => void
}) {
  return (
    <Button
      variant={active ? "secondary" : "ghost"}
      className="h-auto w-full justify-start gap-3 px-3 py-2 text-left"
      aria-label={`${thread.role}, ${thread.company}, ${thread.summary}`}
      aria-current={active ? "true" : undefined}
      onClick={onOpen}
    >
      <Avatar>
        <AvatarFallback>{companyInitials(thread.company)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="truncate font-medium">{thread.role}</span>
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
            {time}
          </span>
        </span>
        <span className="block truncate text-sm text-muted-foreground">
          {thread.company}
        </span>
      </span>
      {thread.unread && thread.status === "open" ? (
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full bg-foreground"
        />
      ) : null}
    </Button>
  )
}

export function CompanyTile({ name }: { name: string }) {
  return (
    <li className="flex w-16 flex-col items-center gap-2 motion-safe:animate-pulse motion-reduce:animate-none">
      <Avatar>
        <AvatarFallback>{companyInitials(name)}</AvatarFallback>
      </Avatar>
      <span className="w-full truncate text-center text-xs text-muted-foreground">
        {name}
      </span>
    </li>
  )
}
